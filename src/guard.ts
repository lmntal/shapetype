import { ContextLink, Link } from "./link";
import { Process } from "./process";

export class Guard {
  cs: Constraint[] = [];

  constructor() {}

  toStr(): string {
    return this.cs.map((c) => c.toStr()).join(", ");
  }

  toRawStr(): string {
    return this.cs.map((c) => c.toRawStr()).join(", ");
  }

  append(c: Constraint) {
    this.cs.push(c);
  }

  join(g: Guard) {
    Array.prototype.push.apply(this.cs, g.cs);
    return this;
  }

  copy(){
    return new Guard().join(this);
  }

  static union(g1: Guard, g2: Guard) {
    let g = new Guard();
    g.join(g1);
    g.join(g2);
    return g;
  }

  // in : $x=$y+1, $a>$b
  // out: [=, >]
  static parse(str: string): Guard {
    let gs = str.split(",");
    let ret = new Guard();
    for (let g of gs) {
      if (g !== "") ret.append(Constraint.parse(g));
    }
    return ret;
  }

  renameRawContexts() {
    for (const c of this.cs) {
      c.renameRawContexts();
    }
  }
}

export class Constraint {
  op: string;
  lhs: ConstraintTerm;
  rhs: ConstraintTerm;

  constructor(op: string, lhs: ConstraintTerm, rhs: ConstraintTerm) {
    this.op = op;
    this.lhs = lhs;
    this.rhs = rhs;
  }

  toStr(): string {
    return `${this.lhs.toStr()}${this.op}${this.rhs.toStr()}`;
  }

  toRawStr(): string {
    return `${this.lhs.toRawStr()}${this.op}${this.rhs.toRawStr()}`;
  }

  toMetaStr(): { str: string; map: { pc: string; link: string }[] } {
    let lhs = this.lhs.toMetaStr();
    let rhs = this.rhs.toMetaStr();

    return {
      str: `op(${lhs.str},"${this.op}",${rhs.str})`,
      map: ([] as { pc: string; link: string }[])
        .concat(lhs.map)
        .concat(rhs.map),
    };
  }

  static parse(str: string): Constraint {
    str = str.trim();
    const res = str.match(/^int\((.*)\)$/)?.[1];
    if (res !== undefined){
      const v = ConstraintTerm.parse(res);
      if (v instanceof ConstraintVariable) {
        return new IntConstraint(v);
      }
    }

    const ops = [">=", "=<", ">", "<", "=\\=", "=:=", "\\=", "="];
    for (let op of ops) {
      const ss = str.split(op);
      if (ss.length === 2) {
        return new Constraint(
          op,
          ConstraintTerm.parse(ss[0]),
          ConstraintTerm.parse(ss[1])
        );
      }
    }
    throw new Error(
      `Parse Error: "${str}" cannot be interpreted as a Constraint`
    );
  }

  renameRawContexts() {
    this.lhs.renameRawContexts();
    this.rhs.renameRawContexts();
  }

  isClosed(pcs: ContextLink[]): boolean {
    const vs = this.getAllVariables();
    for (const v of vs) {
      let flag = false;
      for (const pc of pcs) {
        if (v === pc.name) {
          flag = true;
          break;
        }
      }
      if (!flag) return false;
    }
    return true;
  }

  getAllVariables() {
    let ret = this.lhs.getAllVariables();
    let res = this.rhs.getAllVariables();
    for (const r of res) {
      ret.add(r);
    }
    return ret;
  }

  static getAllVariablesMulti(cs: Constraint[]) {
    let ret = new Set<string>();
    for (const c of cs) {
      let res = c.getAllVariables();
      for (const r of res) {
        ret.add(r);
      }
    }
    return ret;
  }

  getZ3Condition() {
    //[">=","=<",">","<","=\\=","=:=","\\=","="];
    const op = (() => {
      switch (this.op) {
        case ">=":
          return ">=";
        case "=<":
          return "<=";
        case ">":
          return ">";
        case "<":
          return "<";
        case "=\\=":
          return "!=";
        case "=:=":
          return "==";
        case "\\=":
          return "!=";
        case "=":
          return "==";
        default:
          throw new Error(`Unexpected Operator: ${this.op}`);
      }
    })();
    return `${this.lhs.getZ3Condition()}${op}${this.rhs.getZ3Condition()}`;
  }

  static getZ3ConditionMulti(cs: Constraint[]) {
    let ret = [];
    for (const c of cs) {
      ret.push(c.getZ3Condition());
    }
    return ret;
  }
}

class IntConstraint extends Constraint {
  constructor(v: ConstraintVariable){
    super("int", v, v);
  }

  toStr(): string {
    return `${this.op}(${this.lhs.toStr()})`;
  }

  toRawStr(): string {
    return `${this.op}(${this.lhs.toRawStr()})`;
  }
}

abstract class ConstraintTerm {
  abstract toStr(): string;
  abstract toRawStr(): string;
  abstract toMetaStr(): { str: string; map: { pc: string; link: string }[] };

  abstract renameRawContexts(): void;
  abstract getAllVariables(): Set<string>;
  abstract getZ3Condition(): string;

  static parse(str: string): ConstraintTerm {
    str = str.trim();
    const ops = ["*", "+", "-"];
    for (let op of ops) {
      const ss = str.split(op);
      if (ss.length === 2) {
        return new ConstraintOP(
          op,
          ConstraintValue.parse(ss[0]),
          ConstraintValue.parse(ss[1])
        );
      }
    }
    return ConstraintValue.parse(str);
    // throw new Error(`Parse Error: "${str}" cannot be interpreted as a ConstraintTerm`);
  }
}

class ConstraintOP extends ConstraintTerm {
  op: string;
  lhs: ConstraintValue;
  rhs: ConstraintValue;

  toStr(): string {
    return `${this.lhs.toStr()}${this.op}${this.rhs.toStr()}`;
  }

  toRawStr(): string {
    return `${this.lhs.toRawStr()}${this.op}${this.rhs.toRawStr()}`;
  }

  toMetaStr(): { str: string; map: { pc: string; link: string }[] } {
    let lhs = this.lhs.toMetaStr();
    let rhs = this.rhs.toMetaStr();

    return {
      str: `op(${lhs.str},"${this.op}",${rhs.str})`,
      map: ([] as { pc: string; link: string }[])
        .concat(lhs.map)
        .concat(rhs.map),
    };
  }

  constructor(op: string, lhs: ConstraintValue, rhs: ConstraintValue) {
    super();
    this.op = op;
    this.lhs = lhs;
    this.rhs = rhs;
  }

  renameRawContexts() {
    this.lhs.renameRawContexts();
    this.rhs.renameRawContexts();
  }

  getAllVariables() {
    let ret = this.lhs.getAllVariables();
    let res = this.rhs.getAllVariables();
    for (const r of res) {
      ret.add(r);
    }
    return ret;
  }

  getZ3Condition() {
    return `${this.lhs.getZ3Condition()}${this.op}${this.rhs.getZ3Condition()}`;
  }
}

abstract class ConstraintValue extends ConstraintTerm {
  static parse(str: string) {
    str = str.trim();
    if (str.startsWith("$")) {
      return new ConstraintVariable(str.substr(1));
    } else {
      return new ConstraintConstant(str);
    }
  }
}

class ConstraintVariable extends ConstraintValue {
  name: string;
  constructor(str: string) {
    super();
    this.name = str;
  }
  toStr(): string {
    return `$${this.name}`;
  }
  toRawStr(): string {
    return `$${this.name}`;
  }
  toMetaStr(): { str: string; map: { pc: string; link: string }[] } {
    let l = Link.getNewIDLink();
    return {
      str: `v(${l.toStr()})`,
      map: [{ pc: this.toStr(), link: l.toStr() }],
    };
  }

  renameRawContexts() {
    this.name = `v_${this.name}_0`;
  }

  getAllVariables() {
    return new Set<string>([this.name]);
  }
  getZ3Condition() {
    return this.name;
  }
}

class ConstraintConstant extends ConstraintValue {
  name: string;
  constructor(str: string) {
    super();
    this.name = str;
  }
  toStr(): string {
    return this.name;
  }
  toRawStr(): string {
    return this.name;
  }
  toMetaStr(): { str: string; map: { pc: string; link: string }[] } {
    return {
      str: `"${this.name}"`,
      map: [],
    };
  }
  renameRawContexts() {
    /* nothing */
  }
  getAllVariables() {
    return new Set<string>();
  }
  getZ3Condition() {
    return this.name;
  }
}
