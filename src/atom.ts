import { ContextLink, IntLink, Link } from "./link";
import { Graph } from "./graph";
import { Util } from "./util";
import { Process } from "./process";

export class Atom extends Process {
  name: string;
  args: Link[];
  constructor(name: string, args: Link[]) {
    super();
    this.name = name;
    this.args = args;
  }

  toStr(): string {
    // if (this.name === "'='")
    //   // todo
    //   return this.args[0].toStr() + "=" + this.args[1].toStr();
    return this.name + "(" + Link.toStrMulti(this.args) + ")";
  }

  toRawStr(): string {
    // if (this.name === "'='")
    //   // todo
    //   return this.args[0].toRawStr() + "=" + this.args[1].toRawStr();
    console.log(this.toStr());
    throw new Error("toRawStr undefined.");
    // return this.toStr(); //??
  }

  getRawName(): string {
    throw new Error("getRawName undefined.");
    // return this.name; //??
  }

  static toStrMulti(atoms: Atom[]): string {
    let ret = "";
    for (let atom of atoms) {
      ret += atom.toStr() + ",";
    }
    return ret.slice(0, -1);
  }

  static toRawStrMulti(atoms: Atom[]): string {
    let ret = "";
    for (let atom of atoms) {
      ret += atom.toRawStr() + ",";
    }
    return ret.slice(0, -1);
  }

  // in 1: a(X,b)
  // out1: [a(X,Y,PARENT), b(Y)]
  // in 2: somename
  // out2: [somename(PARENT)]
  // allowFreeAtomsはallowFreeAtomsではなく、removePrefixも入る
  static parse(str: string, parent?: Link, allowFreeAtoms?: boolean): Atom[] {
    if (allowFreeAtoms === undefined) allowFreeAtoms = false;
    str = str.trim();

    let ret_eq = str.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
    if (ret_eq !== null) {
      // コネクタに関する処理
      if (ret_eq.length !== 3) {
        throw new Error("Unknown Error in Atom.parse(" + str + ")");
      }
      const isLink = (str: string) =>
        str.match(/^([A-Z][a-zA-Z0-9_]*)$/) !== null;
      if (isLink(ret_eq[1])) {
        if (isLink(ret_eq[2])) {
          // コネクタの両辺がリンク
          return [
            new Connector([
              Link.getNewNameLink(ret_eq[1]),
              Link.getNewNameLink(ret_eq[2]),
            ]),
          ];
        } else {
          // コネクタの左辺のみリンク
          return Atom.parse(
            ret_eq[2],
            Link.getNewNameLink(ret_eq[1]),
            allowFreeAtoms
          );
        }
      } else {
        if (isLink(ret_eq[2])) {
          // コネクタの右辺のみリンク
          return Atom.parse(
            ret_eq[1],
            Link.getNewNameLink(ret_eq[2]),
            allowFreeAtoms
          );
        } else {
          // コネクタの両辺がアトム
          let link = Link.getNewIDLink();
          let res1 = Atom.parse(ret_eq[1], link, allowFreeAtoms);
          let res2 = Atom.parse(ret_eq[2], link, allowFreeAtoms);
          Array.prototype.push.apply(res1, res2);
          return res1;
        }
      }
    }

    let makeAtomName = (str: string) =>
      allowFreeAtoms ? Util.removePrefix(str) : str;
    let ret = str.match(/^\s*(.+?)\s*\(\s*(.*?)\s*\)\s*$/);
    if (ret === null) {
      //
      if (str.match(/^[a-z][a-zA-Z0-9_]*$/) !== null) {
        // 小文字で始まって、丸括弧を含まない
        if (str === "free" && allowFreeAtoms)
          if (parent === undefined) throw new Error("Free atom must be unary.");
          else return [new FreeAtom(parent)];
        else
          return [
            new NameAtom(
              makeAtomName(str),
              parent === undefined ? [] : [parent]
            ),
          ];
      } else if (str.match(/^\$[a-z][a-zA-Z0-9_]*$/) !== null) {
        // $で始まって、丸括弧を含まない（1価プロセス文脈）
        if (parent === undefined)
          throw new Error("ProcessContext must be unary.");
        return [new ProcessContext(str.substr(1), parent)];
      } else if (str.match(/^(?:\+|-|)[0-9]+$/) !== null) {
        // 数値
        if (parent === undefined) throw new Error("Constant must be unary.");
        return [new Constant(parseInt(str), parent)];
      } else {
        throw new Error("Invalid atom name: " + str);
      }
    } else {
      if (ret.length !== 3)
        throw new Error("Unknown Error in Atom.parse(" + str + ")");
      let name = ret[1];
      let args = Atom.commaSplit(ret[2]);
      let ans: Atom[] = []; //new NameAtom(name,[])
      let ansArgs: Link[] = [];
      for (let i = 0; i < args.length; i++) {
        let arg = args[i].trim();
        if (arg.match(/^([A-Z][a-zA-Z0-9_]*|".*")$/) !== null) {
          // 大文字で始まる
          // stringもとりあえずここにいれる
          ansArgs[i] = Link.getNewNameLink(arg);
        } else {
          let link = Link.getNewIDLink();
          ansArgs[i] = link;
          Array.prototype.push.apply(
            ans,
            Atom.parse(arg, link, allowFreeAtoms)
          );
        }
      }
      if (parent !== undefined) ansArgs.push(parent);
      if (name === "free" && allowFreeAtoms) {
        if (ansArgs.length !== 1) throw new Error("Free atom must be unary.");
        ans.unshift(new FreeAtom(ansArgs[0]));
      } else {
        ans.unshift(new NameAtom(makeAtomName(name), ansArgs));
      }
      return ans;
    }
  }

  // in : a(X,Y), b(Z),
  // out: [a,b]
  static parseMulti(str: string, allowfreeAtoms: boolean): Graph {
    let strs = Atom.commaSplit(str);
    let ret: Graph = new Graph([]);
    for (let s of strs) {
      ret.append(Atom.parse(s, undefined, allowfreeAtoms));
    }
    return ret.embedIntLinks();
  }

  // in : a,b(X,Y),c,,d
  // out: ["a","b(X,Y)","c","d"]
  static commaSplit(str: string): string[] {
    let ret: string[] = [];
    let chars = str.split("");
    let content = "";
    let level = 0;
    for (let c of chars) {
      switch (c) {
        case "(":
          level++;
          content += c;
          break;
        case ")":
          level--;
          content += c;
          break;
        case ",":
          if (level === 0) {
            content = content.trim();
            if (content !== "") {
              ret.push(content);
              content = "";
            }
          } else {
            content += c;
          }
          break;
        default:
          content += c;
      }
    }
    if (level !== 0) throw new Error("Invalid parentheses: " + str);
    content = content.trim();
    if (content !== "") ret.push(content);
    return ret;
  }
  in(graph: Graph): boolean {
    for (let atom of graph.atoms) {
      if (this.equalsAlpha(atom)) {
        return true;
      }
    }
    return false;
  }
  equalsAlpha(atom: Atom): boolean {
    return this.name === atom.name && this.args.length === atom.args.length;
  }
  // アトム名まで厳密に一致(=文字列表現が同じ)
  equals(atom: Atom): boolean {
    return this.toStr() === atom.toStr();
  }
  getFreeLinks() {
    return Atom.getFreeLinksMulti([this]);
  }

  static getFreeLinksMulti(atoms: Atom[]): Link[] {
    let res = Atom.getLinkCountsMulti(atoms);
    let ret: Link[] = [];
    for (let link of res.links) {
      if (link instanceof IntLink) continue;
      switch (res.countMap[link.toStr()]) {
        case 1:
          // freelink
          ret.push(link);
          break;
        case 2:
          // locallink
          break;
        default:
          throw new Error(
            "Links must not appear more than 2 times in the same graph: " +
              Atom.toStrMulti(atoms)
          );
      }
    }
    return ret;
  }

  static getLocalLinksMulti(atoms: Atom[]): Link[] {
    let res = Atom.getLinkCountsMulti(atoms);
    let ret: Link[] = [];
    for (let link of res.links) {
      if (link instanceof IntLink) continue;
      switch (res.countMap[link.toStr()]) {
        case 1:
          // freelink
          break;
        case 2:
          // locallink
          ret.push(link);
          break;
        default:
          throw new Error(
            "Links must not appear more than 2 times in the same graph: " +
              Atom.toStrMulti(atoms)
          );
      }
    }
    return ret;
  }

  static getLinkCountsMulti(atoms: Atom[]) {
    let ret: { links: Link[]; countMap: { [key: string]: number } } = {
      links: [],
      countMap: {},
    };
    for (let atom of atoms) {
      for (let link of atom.args) {
        if (ret.countMap[link.toStr()] === undefined) {
          ret.links.push(link);
          ret.countMap[link.toStr()] = 1;
        } else {
          ret.countMap[link.toStr()]++;
        }
      }
    }
    return ret;
  }

  static getProcessContextsMulti(atoms: Atom[]) {
    let res = Atom.getLinkCountsMulti(atoms);
    let ret: ContextLink[] = [];
    for (let link of res.links) {
      if (link instanceof ContextLink) {
        ret.push(link);
      }
    }
    return ret;
  }

  getFunctor():[string,number]{
    return [this.name, this.args.length];
  }

  static getAllFunctorsMulti(atoms: Atom[]): Set<[string, number]> {
    let ret = new Set<[string, number]>();
    for (const a of atoms) {
      ret.add(a.getFunctor());
    }
    return ret;
  }

  closed(preserveLinkName: boolean) {
    return Atom.closedMulti([this], preserveLinkName);
  }

  static closedMulti(atoms: Atom[], preserveLinkName: boolean): Graph {
    let links = Atom.getFreeLinksMulti(atoms);
    let ret = Atom.copyMulti(atoms);
    if (preserveLinkName) {
      for (let link of links) {
        ret.push(Atom.getStringAtomFromLink(link));
      }
    } else {
      for (let link of links) {
        ret.push(Atom.getFreeAtomFromLink(link));
      }
    }
    return new Graph(ret);
  }

  static copyMulti(atoms: Atom[]): Atom[] {
    let ret: Atom[] = [];
    for (let atom of atoms) {
      ret.push(atom.copy());
    }
    return ret;
  }

  copy(): Atom {
    let links: Link[] = [];
    for (let arg of this.args) {
      links.push(arg.copy());
    }
    if (this instanceof FreeAtom) {
      return new FreeAtom(links[0]);
    } else if (this instanceof NameAtom) {
      return new NameAtom(Util.removePrefix(this.name), links);
    } else if (this instanceof Constant) {
      return new Constant(this.value, links[0]);
    } else if (this instanceof ProcessContext) {
      const pc = new ProcessContext(this.givenName, links[0]);
      pc.name = this.name;
      return pc;
    } else if (this instanceof Connector) {
      return new Connector([links[0], links[1]]);
    }
    // else return new Atom(this.name, links);
    throw new Error(`Atom::copy() is not implemented for given type of atom: ${this.toStr()}`)
  }

  static getStringAtomFromLink(link: Link) {
    let name = `"${link.toStr()}"`;
    let newlink = link.copy();
    return new Atom(name, [newlink]);
  }

  static getFreeAtomFromLink(link: Link) {
    let newlink = link.copy();
    return new FreeAtom(newlink);
  }

  replace(l1: Link, l2: Link) {
    for (let i = 0; i < this.args.length; i++) {
      if (this.args[i].name === l1.name) {
        this.args[i] = l2.copy();
      }
    }
  }
}

class NameAtom extends Atom {
  givenName: string;
  constructor(name: string, args: Link[]) {
    super("n_" + name, args);
    this.givenName = name;
  }
  toRawStr(): string {
    return this.givenName + "(" + Link.toRawStrMulti(this.args) + ")";
  }
  getRawName(): string {
    return this.givenName;
  }
}

class FreeAtom extends Atom {
  constructor(link: Link) {
    super("free", [link]);
  }
  toRawStr(): string {
    return "free(" + Link.toRawStrMulti(this.args) + ")";
  }
  getRawName(): string {
    return "free";
  }
}

export class Connector extends Atom {
  constructor(links: [Link,Link]) {
    super("'='", links);
  }
  getRawName(): string {
    return "'='"
  }
  toStr(): string {
    // return this.args[0].toStr() + "=" + this.args[1].toStr();
    return `{+${this.args[0].toStr()},+${this.args[1].toStr()}}`;
  }

  toRawStr(): string {
    return this.args[0].toRawStr() + "=" + this.args[1].toRawStr();
  }

}

export abstract class IntAtom extends Atom {}

export class Constant extends IntAtom {
  value: number;
  constructor(v: number, link: Link) {
    super(`${v}`, [link]);
    this.value = v;
  }
  toRawStr(): string {
    return `${this.value}(${Link.toRawStrMulti(this.args)})`;
  }
  getRawName(): string {
    return `${this.value}`;
  }
}

export class ProcessContext extends IntAtom {
  givenName: string;
  constructor(givenName: string, link: Link) {
    super(`$${givenName}`, [link]);
    this.givenName = givenName;
  }
  toRawStr(): string {
    return `$${this.givenName}(${Link.toRawStrMulti(this.args)})`;
  }
  getRawName(): string {
    return `${this.givenName}`;
  }
}
