import { Atom, Connector, IntAtom } from "./atom";
import { IntLink, Link } from "./link";
import { Process } from "./process";
import { Util } from "./util";

export class Graph extends Process {
  atoms: Atom[];

  constructor(atoms: Atom[]) {
    super();
    this.atoms = atoms;
  }
  toStr(indent?: string): string {
    return (indent || "") + Atom.toStrMulti(this.atoms);
  }

  toRawStr(indent?: string): string {
    return (indent || "") + Atom.toRawStrMulti(this.atoms);
  }

  closed(preserveLinkName: boolean): Graph {
    return Atom.closedMulti(this.atoms, preserveLinkName);
  }

  getFreeLinks(): Link[] {
    return Atom.getFreeLinksMulti(this.atoms);
  }

  getLocalLinks() {
    return Atom.getLocalLinksMulti(this.atoms);
  }

  getProcessContexts() {
    return Atom.getProcessContextsMulti(this.atoms);
  }

  getAllFunctors(): Set<[string, number]> {
    return Atom.getAllFunctorsMulti(this.atoms);
  }

  append(atoms: Atom[]): Graph {
    Array.prototype.push.apply(this.atoms, atoms);
    return this;
  }

  join(graph: Graph): Graph {
    Array.prototype.push.apply(this.atoms, graph.atoms);
    return this;
  }

  push(atom: Atom): Graph {
    this.atoms.push(atom);
    return this;
  }

  copy(): Graph {
    return new Graph(Atom.copyMulti(this.atoms));
  }

  // atomsの冪集合、ただし空集合を除く
  // とりうるアトムの集合とその補集合の組の配列を返す
  // つまり、[a,b] in retval なら a cup b = atoms, a cap b = empty
  getPowerSet(): [Graph, Graph][] {
    let ret: [Graph, Graph][] = [];
    let n = this.atoms.length;
    for (let i = 1; i < 1 << n; i++) {
      let ret1: Graph = new Graph([]);
      let ret2: Graph = new Graph([]);
      for (let k = 0; k < n; k++) {
        if ((i >> k) % 2 === 1) ret1.push(this.atoms[k].copy());
        else ret2.push(this.atoms[k].copy());
      }
      ret.push([ret1, ret2]);
    }

    // コネクタの扱い
    let ret1: [Graph, Graph][] = [];
    for (const p of ret) {
      const locals = Atom.getLocalLinksMulti(p[0].atoms);
      for (let i = 0; i < 1 << locals.length; i++) {
        let graph = p[0].copy();
        let cograph = p[1].copy();
        for (let k = 0; k < locals.length; k++) {
          if ((i >> k) % 2 === 1) {
            const lp: [Link, Link] = [Link.getNewIDLink(), Link.getNewIDLink()];
            graph.globalize(locals[k], lp);
            cograph.push(new Connector(lp));
          }
        }
        ret1.push([graph, cograph]);
      }
    }
    return ret1;
  }

  // 局所リンクfromの出現をtos[0],tos[1]で置き換える
  globalize(from: Link, tos: [Link, Link]) {
    let index = 0;
    for (let i = 0; i < this.atoms.length; i++) {
      const links = this.atoms[i].args;
      for (let j = 0; j < links.length; j++) {
        if (links[j].name === from.name) {
          const to = tos[index];
          index++;
          if (to === undefined)
            throw new Error(
              "Globalize Error: the specified link appeared more than twice"
            );
          else this.atoms[i].args[j] = to;
        }
      }
    }
  }

  // 差集合: this - graph
  difference(graph: Graph): Graph {
    let ret = new Graph([]);
    for (let atom of this.atoms) {
      let flag = true;
      for (let atom1 of graph.atoms) {
        if (atom.equals(atom1)) {
          flag = false;
          break;
        }
      }
      if (flag) ret.push(atom);
    }
    return ret;
  }

  removeFreeAtoms(): Graph {
    let ret = new Graph([]);
    for (let atom of this.atoms) {
      if (atom.name !== "free") {
        ret.push(atom.copy());
      }
    }
    return ret;
  }

  static parse(str: string, allowfreeatoms?: boolean): Graph {
    const undefChecker = (a: undefined | boolean) =>
      a === undefined ? false : a;
    return str
      .split(".")
      .reduce(
        (prev, s) =>
          prev.join(Atom.parseMulti(s, undefChecker(allowfreeatoms))),
        new Graph([])
      );
  }

  equals(graph: Graph): boolean {
    if (this.atoms.length !== graph.atoms.length) return false;
    let g1 = (<Atom[]>[]).concat(this.atoms);
    let g2 = (<Atom[]>[]).concat(graph.atoms);
    for (let a of g1) {
      if (
        !(() => {
          for (let i = 0; i < g2.length; i++) {
            if (a.equalsAlpha(g2[i])) {
              g2.splice(i, 1);
              return true;
            }
          }
          return false;
        })()
      )
        return false;
    }
    return Util.isCongruent(
      this.closed(false).toStr(),
      graph.closed(false).toStr()
    );
  }

  // プロセス文脈と定数をリンクに埋め込む
  embedIntLinks() {
    let ints: IntAtom[] = [];
    let graph: Graph = new Graph([]);
    for (const a of this.atoms) {
      if (a instanceof IntAtom) {
        ints.push(a.copy());
      } else {
        graph.push(a.copy());
      }
    }

    for (const i of ints) {
      graph.replace(i.args[0], IntLink.convert(i));
    }
    return graph;
  }

  replace(l1: Link, l2: Link) {
    for (const a of this.atoms) {
      a.replace(l1, l2);
    }
  }
}
