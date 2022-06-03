import { Constant, IntAtom, ProcessContext } from "./atom";
import { Process } from "./process";

export abstract class Link extends Process {
  name: string;
  className: string;
  constructor(name: string, className: string) {
    super();
    this.name = name;
    this.className = className;
  }
  toStr(): string {
    return this.name;
  }
  static toStrMulti(links: Link[]): string {
    let ret = "";
    for (let link of links) {
      ret += link.toStr() + ",";
    }
    return ret.slice(0, -1);
  }
  static toRawStrMulti(links: Link[]): string {
    let ret = "";
    for (let link of links) {
      ret += link.toRawStr() + ",";
    }
    return ret.slice(0, -1);
  }
  static getNewIDLink() {
    return IDLink.getNew();
  }
  static getNewNameLink(name: string) {
    return new NameLink(name);
  }
  getStringGuard() {
    return `string(${this.toStr()})`;
  }
  static getStringGuardMulti(links: Link[]) {
    let ret = "";
    for (let link of links) {
      ret += link.getStringGuard() + ",";
    }
    return ret.slice(0, -1);
  }
  copy(): Link {
    if (this instanceof IDLink) return new IDLink(this.id);
    else if (this instanceof NameLink) return new NameLink(this.givenName);
    // if (this instanceof AtomLink)
    //   return new AtomLink(this.atom,this.argnum);
    // if (this instanceof FreeLink)
    //   return new FreeLink(this.givenName);
    else if (this instanceof ConstIntLink) return new ConstIntLink(this.value);
    else if (this instanceof ContextLink) {
      const pc = new ContextLink(this.givenName);
      pc.name = this.name;
      return pc;
    } else throw new Error("Type Not Implemented");
  }
  // 差集合: ls1 - ls2
  static difference(ls1: Link[], ls2: Link[]) {
    let ret: Link[] = [];
    for (let l1 of ls1) {
      let flag = true;
      for (let l2 of ls2) {
        if (l1.name === l2.name) {
          flag = false;
          break;
        }
      }
      if (flag) ret.push(l1);
    }
    return ret;
  }
}

class IDLink extends Link {
  id: number;
  static nextID: number = 0;
  constructor(id: number) {
    super("I_" + id, "IDLink");
    this.id = id;
  }
  static getNew() {
    return new IDLink(IDLink.nextID++);
  }
  toRawStr(): string {
    return this.name;
  }
}

class NameLink extends Link {
  givenName: string;
  constructor(name: string) {
    super("N_" + name, "NameLink");
    this.givenName = name;
  }
  toRawStr(): string {
    return this.givenName;
  }
}

export abstract class IntLink extends Link {
  toRawStr(): string {
    return this.name;
  }
  static convert(a: IntAtom): IntLink {
    if (a instanceof ProcessContext) {
      return new ContextLink(a.givenName);
    } else if (a instanceof Constant) {
      return new ConstIntLink(a.value);
    }
    throw new Error(`Error: Unexpected IntAtom: ${a.toStr()}`);
  }
}

export class ConstIntLink extends IntLink {
  value: number;
  constructor(value: number) {
    super(`${value}`, "ConstIntLink");
    this.value = value;
  }
}

export class ContextLink extends IntLink {
  givenName: string;
  constructor(givenName: string) {
    super(`$${givenName}`, "ContextLink");
    this.givenName = `${givenName}`;
  }
}

// // AtomにはIDを振って区別できるようにするべきかも
// class AtomLink extends Link{
//   atom:Atom;
//   argnum:number;
//   constructor(atom:Atom,argnum:number){
//     super("A_"+atom.toStr()+"_"+argnum,"AtomLink");
//     this.atom = atom;
//     this.argnum = argnum;
//   }
//   toRawStr():string{
//     return this.atom.toStr();
//   }
// }

// class FreeLink extends Link{
//   givenName:string
//   constructor(name:string){
//     super("F_"+name,"FreeLink");
//     this.givenName = name;
//   }
//   toRawStr():string{
//     return this.givenName;
//   }
// }
