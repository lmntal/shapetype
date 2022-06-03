import { Atom } from "./atom";
import { Graph } from "./graph";
import { Process } from "./process";
import { ConstIntLink, ContextLink, Link } from "./link";
import { Guard } from "./guard";

// lhs :- rhs
export class Rule extends Process {
  static nextID: number = 0;
  name: string;
  lhs: Graph;
  rhs: Graph;
  guard: Guard;
  id: number;
  coset: Graph | undefined;
  set: Graph | undefined;
  origin: Rule | undefined;
  gcheck: Rule | undefined;
  constructor(lhs: Graph, guard: Guard, rhs: Graph, name: string) {
    super();
    this.id = Rule.nextID++;
    if (name === undefined) this.name = "id" + this.id;
    else this.name = name;
    this.lhs = lhs;
    this.rhs = rhs;
    this.guard = guard;
  }

  toStr(): string {
    if (this.guard.toStr().trim()===""){
      return `${
        this.name
      }@@ ${this.lhs.toStr()} :- ${this.rhs.toStr()}.`;
    } else {
      return `${
        this.name
      }@@ ${this.lhs.toStr()} :- ${this.guard.toStr()} | ${this.rhs.toStr()}.`;
    }
  }
  toRawStr(): string {
    if (this.guard.toRawStr().trim()===""){
      return `${
        this.name
      }@@ ${this.lhs.toRawStr()} :- ${this.rhs.toRawStr()}.`;
    } else {
      return `${
        this.name
      }@@ ${this.lhs.toRawStr()} :- ${this.guard.toRawStr()} | ${this.rhs.toRawStr()}.`;
    }
  }
  static toStrMulti(rules: Rule[], indent?: string): string {
    let ret = "";
    for (let rule of rules) {
      ret += (indent || "") + rule.toStr() + "\n";
    }
    return ret;
  }
  static toRawStrMulti(rules: Rule[], indent?: string): string {
    let ret = "";
    for (let rule of rules) {
      ret += (indent || "") + rule.toRawStr() + "\n";
    }
    return ret;
  }

  getAllFunctors(): Set<[string, number]> {
    let ret = this.lhs.getAllFunctors();
    const res = this.rhs.getAllFunctors();
    for (const f of res) {
      ret.add(f);
    }
    return ret;
  }

  addGuard(str: string) {
    this.guard.join(Guard.parse(str));
  }

  guardAddedString(str: string): string {
    return new Rule(
      this.lhs,
      Guard.union(this.guard, Guard.parse(str)),
      this.rhs,
      this.name
    ).toStr();
  }

  // in 1 : a :- a,b,c
  // out1 : ([a],[a,b,c])
  static parse(str: string): Rule {
    let ret = str.match(
      /^(?:\s*(.+?)\s*@@|)\s*(.+?)\s*:-(?:\s*(.+?)\s*\||)\s*(.+?)\s*$/
    );
    if (ret === null) throw new Error("Invalid Rule: " + str);
    if (ret.length !== 5)
      throw new Error("Unknown Error in Rule.parse(" + str + ")");
    let name = ret[1];
    let lhs = Atom.parseMulti(ret[2], false);
    let guard = Guard.parse(ret[3] ?? "");
    let rhs = Atom.parseMulti(ret[4], false);
    let r = new Rule(lhs, guard, rhs, name);
    r.makeProcessContextsUnique();
    return r;
  }

  // in : a:-b. b:-c.
  // out: [([a],[b]),([b],[c])]
  static parseMulti(str: string): Rule[] {
    let strs = str.split(".");
    let ret: Rule[] = [];
    for (let s of strs) {
      s = s.trim();
      if (s !== "") ret.push(Rule.parse(s));
    }
    return ret;
  }

  getReversed(): Rule {
    return new Rule(this.rhs, this.guard, this.lhs, "rev_" + this.name);
  }

  getReversedForGcheck(): Rule {
    const r = this.gcheck;
    if (!r) throw new Error("gcheck is undefined");
    return new Rule(r.rhs, r.guard, r.lhs, "rev_" + r.name);
  }

  static getReversedMulti(rules: Rule[]): Rule[] {
    let ret: Rule[] = [];
    for (let rule of rules) {
      ret.push(rule.getReversed());
    }
    return ret;
  }

  static getReversedMultiForGcheck(rules: Rule[]): Rule[]{
    let ret: Rule[] = [];
    for (let rule of rules) {
      ret.push(rule.getReversedForGcheck());
    }
    return ret;
  }

  getReversedWithConstraints(): Rule8 {
    let rhs = this.rhs.copy();
    let lhs = this.lhs.copy();

    let rhs_fl = rhs.getFreeLinks();
    // let lhs_fl = lhs.getFreeLinks();

    const rhs_pcs = rhs.getProcessContexts();
    const lhs_pcs = lhs.getProcessContexts();

    let rhs_proxy_arr = {} as { [key: string]: string[] };
    let lhs_proxy_arr = {} as { [key: string]: string[] };
    let index = 0;
    for (const pc of rhs_pcs) {
      const l = Link.getNewIDLink();
      rhs.replace(pc, l);
      rhs_proxy_arr[pc.toStr()] = [`${l.toStr()}=proxy`, `$p${index}`];
      lhs_proxy_arr[pc.toStr()] = [`$p${index}`];
      index++;
    }

    for (const pc of lhs_pcs) {
      const l = Link.getNewIDLink();
      lhs.replace(pc, l);
      lhs_proxy_arr[pc.toStr()] = [`${l.toStr()}=proxy`];
    }

    let cs = [] as string[];
    for (let c of this.guard.cs) {
      let tag = c.isClosed(rhs_pcs) ? "post" : "pre";
      let res = c.toMetaStr();
      cs.push(`${tag}=${res.str}`);
      for (const m of res.map) {
        lhs_proxy_arr[m.pc].push(`${m.link}=v`);
      }
    }

    const f = (arr: { [key: string]: string[] }) => {
      let res = [] as string[];
      for (const k in arr) {
        res.push(`{${arr[k].join(",")}}`);
      }
      return res.join() + (res.length === 0 ? "" : ",");
    };

    const head = `rule({$p[|*A]},{${rhs.toStr()},$q[${Link.toStrMulti(
      rhs_fl
    )}|*B]},{${f(rhs_proxy_arr)}$r[|*C]})`;
    const body = `rule({$p[|*A]},{${lhs.toStr()},$q[${Link.toStrMulti(
      rhs_fl // 順番は揃える
    )}|*B]},{${f(lhs_proxy_arr)}${cs}${cs.length === 0 ? "" : ","}$r[|*C]})`;

    return new Rule8(head, "", body, `rev_${this.name}`);
  }

  static getReversedWithConstraintsMulti(rules: Rule[]): Rule8[] {
    let ret: Rule8[] = [];
    for (let rule of rules) {
      ret.push(rule.getReversedWithConstraints());
    }
    return ret;
  }

  copy(){
    return new Rule(this.lhs.copy(),this.guard.copy(),this.rhs.copy(),this.name);
  }

  // 同名の（リンク化された）プロセス文脈を排除し、代わりに等価性制約を入れる
  // ついでに左辺・右辺にベタ書きされた定数をガードに移動する
  makeProcessContextsUnique() {
    let map: { [key: string]: number } = {};
    let constArr: number[] = [];
    let ints: string[] = [];

    for (let a of this.lhs.atoms) {
      for (let i = 0; i < a.args.length; i++) {
        const l = a.args[i];
        if (l instanceof ContextLink) {
          const n = map[l.givenName] ?? 0;
          l.name = `$v_${l.givenName}_${n}`;
          map[l.givenName] = n + 1;
        }
      }
    }

    for (let a of this.rhs.atoms) {
      for (let i = 0; i < a.args.length; i++) {
        const l = a.args[i];
        if (l instanceof ContextLink) {
          const n = map[l.givenName] ?? 0;
          l.name = `$v_${l.givenName}_${n}`;
          map[l.givenName] = n + 1;
          ints.push(l.name);
        }
      }
    }

    this.guard.renameRawContexts();
    for (const k in map) {
      const v = map[k];
      for (let i = 0; i < v - 1; i++) {
        this.guard.join(Guard.parse(`$v_${k}_${i}=$v_${k}_${i + 1}`));
      }
    }

    this.gcheck = this.copy();
    for (const s of ints){
      this.gcheck.guard.join(Guard.parse(`int(${s})`));
    }

    for (let a of this.lhs.atoms) {
      for (let i = 0; i < a.args.length; i++) {
        const l = a.args[i];
        if (l instanceof ConstIntLink) {
          let c = l.value;
          a.args[i] = new ContextLink(`${c}`);
          a.args[i].name = `$c_${constArr.length}`;
          constArr.push(c);
        }
      }
    }

    for (let a of this.rhs.atoms) {
      for (let i = 0; i < a.args.length; i++) {
        const l = a.args[i];
        if (l instanceof ConstIntLink) {
          let c = l.value;
          a.args[i] = new ContextLink(`${c}`);
          a.args[i].name = `$c_${constArr.length}`;
          constArr.push(c);
        }
      }
    }

    for (let i = 0; i < constArr.length; i++) {
      this.guard.join(Guard.parse(`$c_${i}=${constArr[i]}`));
    }
  }
}

// ルールの型検査2用のルール
export class Rule2 {
  name: string;
  lhs: string;
  rhs: string;
  guard: string;
  constructor(lhs: string, rhs: string, name: string) {
    this.name = name;
    this.lhs = lhs;
    this.rhs = rhs;
    this.guard = "";
  }

  // from: L, supply: C, to: L'
  static make(from: Graph, supply: Graph, to: Graph, name: string): Rule2 {
    let head_fl = Link.difference(from.getFreeLinks(), supply.getFreeLinks()); // X
    let body_fl = Link.difference(from.getFreeLinks(), to.getFreeLinks()); // L
    let lhs = `head{${from.toStr()}${
      from.atoms.length === 0 ? "" : ","
    }$p[${Link.toStrMulti(head_fl)}|*A]},body{$q[${Link.toStrMulti(
      body_fl
    )}|*B]}`;
    let rhs = `head{${to.toStr()}${
      to.atoms.length === 0 ? "" : ","
    }$p[${Link.toStrMulti(head_fl)}|*A]},body{${supply.toStr()}${
      supply.atoms.length === 0 ? "" : ","
    }$q[${Link.toStrMulti(body_fl)}|*B]}`;
    return new Rule2(lhs, rhs, name);
  }
  toStr(): string {
    return `${this.name}@@ ${this.lhs} :- ${this.guard} | ${this.rhs}.`;
  }
  static toStrMulti(rules: Rule2[]): string {
    return rules.map((r) => r.toStr()).join("\n");
  }

  // guardAddedString(str: string): string{
  //   let g = (this.guard === null || this.guard === "" ? str : `${this.guard},${str}`);
  //   return `${this.name}@@ ${this.lhs} :- ${g} | ${this.rhs}.`;
  // }

  // static guardAddedStringMulti(rules:Rule2[],str:string):string {
  //   return rules
  //     .map((r) => r.guardAddedString(str))
  //     .join("\n");
  // }
}

// ルールの型検査8用のルール
export class Rule8 {
  name: string;
  lhs: string;
  rhs: string;
  guard: string;
  constructor(lhs: string, guard: string, rhs: string, name: string) {
    this.name = name;
    this.lhs = lhs;
    this.rhs = rhs;
    this.guard = guard;
  }

  static make(
    from: Graph,
    supply: Graph,
    to: Graph,
    guard: Guard,
    name: string
  ): Rule8 {
    let head_fl = Link.difference(from.getFreeLinks(), supply.getFreeLinks()); // X
    let body_fl = Link.difference(from.getFreeLinks(), to.getFreeLinks()); // L

    const from_pcs = from.getProcessContexts();
    const supply_pcs = supply.getProcessContexts();
    const to_pcs = to.getProcessContexts();

    let rhs_proxy_arr = {} as { [key: string]: string[] };
    let lhs_proxy_arr = {} as { [key: string]: string[] };
    let index = 0;
    for (const pc of supply_pcs) {
      const l = Link.getNewIDLink();
      supply.replace(pc, l);
      rhs_proxy_arr[pc.toStr()] = [`${l.toStr()}=proxy`];
    }
    for (const pc of to_pcs) {
      const l = Link.getNewIDLink();
      to.replace(pc, l);
      rhs_proxy_arr[pc.toStr()] = [`${l.toStr()}=proxy`];
    }

    for (const pc of from_pcs) {
      const l = Link.getNewIDLink();
      from.replace(pc, l);
      lhs_proxy_arr[pc.toStr()] = [`${l.toStr()}=proxy`, `$p${index}`];
      rhs_proxy_arr[pc.toStr()] = [`$p${index}`];
      index++;
    }

    let cs = [] as string[];
    for (let c of guard.cs) {
      let res = c.toMetaStr();
      cs.push(`pre=${res.str}`);
      for (const m of res.map) {
        rhs_proxy_arr[m.pc].push(`${m.link}=v`);
      }
    }

    const f = (arr: { [key: string]: string[] }) => {
      let res = [] as string[];
      for (const k in arr) {
        res.push(`{${arr[k].join(",")}}`);
      }
      return res.join() + (res.length === 0 ? "" : ",");
    };

    let lhs = `rule({${from.toStr()}${
      from.atoms.length === 0 ? "" : ","
    }$p[${Link.toStrMulti(head_fl)}|*A]},{$q[${Link.toStrMulti(
      body_fl
    )}|*B]},{${f(lhs_proxy_arr)}$r[|*C]})`;
    let rhs = `rule({${to.toStr()}${
      to.atoms.length === 0 ? "" : ","
    }$p[${Link.toStrMulti(head_fl)}|*A]},{${supply.toStr()}${
      supply.atoms.length === 0 ? "" : ","
    }$q[${Link.toStrMulti(body_fl)}|*B]},{${f(rhs_proxy_arr)}${cs}${
      cs.length === 0 ? "" : ","
    }$r[|*C]})`;
    return new Rule8(lhs, "", rhs, name);
  }
  toStr(): string {
    return `${this.name}@@ ${this.lhs} :- ${this.guard} | ${this.rhs}.`;
  }
  static toStrMulti(rules: Rule8[]): string {
    return rules.map((r) => r.toStr()).join("\n");
  }
}
