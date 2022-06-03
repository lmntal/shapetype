import { Atom } from "./atom";
import { Rule, Rule2, Rule8 } from "./rule";
import { Graph } from "./graph";
import { Link } from "./link";
import { Util } from "./util";
import { Process } from "./process";
import { Guard } from "./guard";
import { readFileSync } from "fs";
import { execSync } from "child_process";

export class ShapeType extends Process {
  start: Atom;
  name: string;
  rules: Rule[];
  nonterminals: Graph;
  static lmntal: string;
  static slim: string;
  static useNcore: number;
  constructor(start: Atom, rules: Rule[], nonterminals: Graph) {
    super();
    this.start = start;
    this.rules = rules;
    this.nonterminals = nonterminals;
    this.name = start.getRawName();
  }

  static initPaths(lmntal: string, slim: string, useNcore: number) {
    ShapeType.lmntal = lmntal;
    ShapeType.slim = slim;
    ShapeType.useNcore = useNcore;
  }

  toStr(): string {
    const indent = "  ";
    return (
      "ShapeType " +
      this.start.toStr() +
      "{\n" +
      Rule.toStrMulti(this.rules, indent) +
      "}nonterminals{\n" +
      this.nonterminals.toStr(indent) +
      "\n}"
    );
  }
  toRawStr(): string {
    const indent = "  ";
    return (
      "ShapeType " +
      this.start.toRawStr() +
      "{\n" +
      Rule.toRawStrMulti(this.rules, indent) +
      "}nonterminals{\n" +
      this.nonterminals.toRawStr(indent) +
      "\n}"
    );
  }

  static parse(str: string) {
    str = str.split("\n").join(" ");
    let ret = str.match(
      /^\s*defshape\s+(.+?)\{\s*(.+?)\s*\}\s*(?:|nonterminal\s*\{\s*(.+?)\s*\}\s*)$/
    );
    if (ret === null) throw new Error("Invalid ShapeType");
    let starts = Atom.parse(ret[1]);
    if (starts.length !== 1)
      throw new Error("Start Symbol must not have atoms as an argument");
    let start = starts[0];
    let rules = Rule.parseMulti(ret[2]);
    let nonterminals: Graph;
    if (ret[3] !== undefined) {
      nonterminals = Atom.parseMulti(ret[3], false);
      nonterminals.push(start);
    } else {
      nonterminals = new Graph([start]);
    }
    return new ShapeType(start, rules, nonterminals);
  }

  isExtensive(): boolean{
    const fs = this.getAllFunctors();
    fs.add(["'='",2]);
    const functor2varname = (f:[string,number])=>{
      if (f[0]==="'='" && f[1]===2) return 'w_connector'
      else return `w_${f[0]}_${f[1]}`;
    };
    const vars = [] as string[];
    for (const f of fs) {
      vars.push(functor2varname(f));
    }

    const graph2sum = (g:Graph)=>g.atoms.map((a)=>functor2varname(a.getFunctor())).join("+");
    const pyinput = `python -c 'from z3 import *; ${vars.join(",")}=Ints("${vars.join(" ")}"); s=Solver(); ${vars.map((s)=>s==="w_connector"?"s.add(w_connector == 0)":`s.add(${s} > 0)`).join("; ")}; ${this.rules.map((r)=>`s.add(${graph2sum(r.lhs)} <= ${graph2sum(r.rhs)})`).join("; ")}; r=s.check(); print (s.model() if r == sat else r)'`;
    console.log(pyinput);
    const pyres = execSync(pyinput, {encoding: "utf8"});
    console.log(pyres);
    return pyres.trim() !== "unsat";
  }

  /**
   * @returns 型制約を満たす範囲における、開始記号の引数に対する、検査対象グラフの自由リンクの割り当ての配列を返す。
   * @param graph 型検査の対象となるグラフ
   * @param preserveLinkNames これがTrueの場合、自由リンクの名前まで厳密に一致していなければならない
   */
  graphTypeCheck(graph: Graph, preserveLinkNames?: boolean): string[][] {
    for (let atom of graph.atoms) {
      if (atom.in(this.nonterminals)) {
        return [];
      }
    }
    return this.graphGenerationCheck(graph, preserveLinkNames);
  }

  graphGenerationCheck(graph: Graph, preserveLinkNames?: boolean): string[][] {
    if (preserveLinkNames === undefined) preserveLinkNames = false;

    let startFLinks = this.start.getFreeLinks();
    // equality of # of freelinks
    if (startFLinks.length !== graph.getFreeLinks().length) {
      return [];
    }
    // To verify: this:ShapeType generates atoms:Atom[] ?
    let goalRule: string;
    if (preserveLinkNames) {
      goalRule = `{${this.start.closed(true).toStr()}, @p} :- .`;
    } else {
      goalRule = `{${this.start.toStr()}, @p} :- ${Link.getStringGuardMulti(
        startFLinks
      )} | .`;
    }
    let reversedRules = Rule.getReversedMultiForGcheck(this.rules);
    const indent = "  ";

    let program =
      "{\n  " +
      graph.closed(true).toStr() +
      ".\n\n" +
      Rule.toStrMulti(reversedRules, indent) +
      "}.\n\ngoal@@ " +
      goalRule +
      "\n";
    // console.error("----- Generated Program -----\n"+program);
    let slimout = Util.runSlimNd(program);
    // console.error("----- SLIM Output -----\n"+slimout);

    if (slimout.match(/^\d+::{}$/gm) === null) return [];
    let lastStates = slimout.match(
      new RegExp("^\\d+::{{" + this.start.name + "[^.]*\\. }\\. }", "gm")
    );
    if (lastStates === null)
      throw new Error("Unexpected Error in graph type checking.");

    // 開始記号が閉じている場合、「空集合」という一通りで型制約を満たす
    if (startFLinks.length === 0) return [[]];
    let ret: string[][] = [];
    for (let s of lastStates) {
      let ret1: string[] | null = [];
      let atoms = Atom.parse(
        Util.nullChecker(
          s.match(
            new RegExp("^\\d+::{{(" + this.start.name + "\\(.*\\))\\. }\\. }$")
          )
        )[1]
      );
      if (atoms.length !== 1) continue;
      let links = atoms[0].args;
      for (let link of links) {
        if (link.toRawStr().match(/^".*"$/) === null) {
          ret1 = null;
          break;
        }
        ret1.push(Util.removePrefix(link.toRawStr().slice(1, -1)));
      }
      if (ret1 !== null) ret.push(ret1);
    }
    return ret;
  }

  // ルールの型検査ver.3
  ruleTypeCheck3(rule: Rule): boolean {
    // 左辺・右辺いずれかに非終端記号を含んでいたらfalse
    for (let a of rule.lhs.atoms) {
      if (a.in(this.nonterminals)) {
        return false;
      }
    }
    for (let a of rule.rhs.atoms) {
      if (a.in(this.nonterminals)) {
        return false;
      }
    }
    const ret = this.ruleTypeCheck3sub(rule, []);
    if (typeof ret === "number") throw new Error("Unexpected return value");
    return ret;
  }

  ruleTypeCheck3sub(rule: Rule, visited: Rule[]): number | boolean {
    Util.log(rule.toRawStr(), 1);
    // 左辺が開始記号にたどり着いたら
    const lhs = rule.lhs.atoms;
    if (lhs.length === 1 && lhs[0].equalsAlpha(this.start)) {
      Util.log("Start Symbol.", 1);
      if (this.reduce(rule.rhs, rule.lhs)) {
        return true;
      } else {
        Util.log("Counter Example Found!", 1);
        Util.log(Rule.toRawStrMulti(visited), 1);
        return false;
      }
    }

    // （左辺基準で）閉路を見つけたら
    for (let i = 0; i < visited.length; i++) {
      const v = visited[i];
      if (v.lhs.equals(rule.lhs)) {
        Util.log("Cycle.", 1);
        if (this.reduce(v.rhs, v.lhs)) return visited.length - i;
        else {
          Util.log("Counter Example Found!", 1);
          Util.log(Rule.toRawStrMulti(visited), 1);
          return false;
        }
      }
    }

    visited.push(rule);
    let rules = this.getRuleTypeCheck2Rules();
    let ress = Util.runOneStepNd2(
      `head{${rule.lhs.toStr()}},body{${rule.rhs.toStr()}}.`,
      rules
    );
    // console.log(ress);
    for (let res of ress) {
      let mat = Util.nullChecker(
        res.match(/^body{(.*?)\. }, head{(.*?)\. }\.$/)
      );
      let body = mat[1];
      let head = mat[2];
      let p = (str: string) => Graph.parse(str, true);
      let ret = this.ruleTypeCheck3sub(
        new Rule(p(head), new Guard(), p(body), "toCheck"),
        visited
      );
      if (typeof ret === "boolean" && ret === false) return false;
      if (typeof ret === "number" && ret > 0) return ret - 1;
    }
    visited.pop();
    return true;
  }

  // ルールの型検査ver.2 RCheck
  ruleTypeCheck2(rule: Rule) {
    // 左辺・右辺いずれかに非終端記号を含んでいたらfalse
    for (let a of rule.lhs.atoms) {
      if (a.in(this.nonterminals)) {
        return false;
      }
    }
    for (let a of rule.rhs.atoms) {
      if (a.in(this.nonterminals)) {
        return false;
      }
    }
    return this.ruleTypeCheck2sub(rule);
  }

  // RCheckSub
  ruleTypeCheck2sub(rule: Rule) {
    // 左辺の終端記号が全ていなくなったら
    let flag = false;
    for (let a of rule.lhs.atoms) {
      if (!a.in(this.nonterminals)) {
        flag = true;
        break;
      }
    }
    if (!flag) {
      return this.reduce(rule.rhs, rule.lhs);
    }
    let rules = this.getRuleTypeCheck2Rules();
    let ress = Util.runOneStepNd2(
      `head{${rule.lhs.toStr()}},body{${rule.rhs.toStr()}}.`,
      rules
    );
    // console.log(ress);
    for (let res of ress) {
      let mat = Util.nullChecker(
        res.match(/^body{(.*?)\. }, head{(.*?)\. }\.$/)
      );
      let body = mat[1];
      let head = mat[2];
      let p = (str: string) => Graph.parse(str, true);
      if (
        !this.ruleTypeCheck2sub(
          new Rule(p(head), new Guard(), p(body), "toCheck")
        )
      ) {
        return false;
      }
    }
    return true;
  }

  // Reduce: xから遡ってyに到達できるかを調べる
  reduce(x: Graph, y: Graph) {
    let goalRule = `{${y.closed(true).toStr()}, @p} :- .`;
    let reversedRules = Rule.getReversedMulti(this.rules);
    const indent = "  ";

    let program =
      "{\n  " +
      x.closed(true).toStr() +
      ".\n\n" +
      Rule.toStrMulti(reversedRules, indent) +
      "}.\n\ngoal@@ " +
      goalRule +
      "\n";
    // console.error("----- Generated Program -----\n"+program);
    let slimout = Util.runSlimNd(program);
    // console.error("----- SLIM Output -----\n"+slimout);

    if (slimout.match(/^\d+::{}$/gm) === null) return false;
    else return true;
  }

  // ルールの型検査
  ruleTypeCheck(rule: Rule) {
    let graphs = this.getGenerationPaths(rule.lhs);
    for (let lhs of graphs) {
      // console.log("graph: "+graph.slice(0,-1));
      // console.log("rule: "+rule.toStr());
      let res = Util.runOneStepNd(lhs, rule);
      for (let rhs of res) {
        // console.log("rhs: "+rhs);
        let graph = Atom.parseMulti(
          rhs.slice(0, -1).replace(".", ","),
          true
        ).removeFreeAtoms();
        // console.log("graph: "+graph.toStr());
        let res = this.graphGenerationCheck(graph, false);
        if (res.length === 0) {
          Util.log("----- Counter Example -----", 1);
          Util.log(
            Atom.parseMulti(lhs.slice(0, -1).replace(".", ","), true)
              .removeFreeAtoms()
              .toRawStr(),
            1
          );
          Util.log(" :- " + graph.toRawStr(), 1);
          Util.log("", 1);
          return false;
        }
      }
    }
    return true;
  }

  // ルール左辺を受け取って、その生成パスを列挙する
  // 開始記号から各生成パスを辿ってできる全てのグラフの文字列表現を返す
  // これには必要な外部グラフが含まれている
  getGenerationPaths(lhs: Graph) {
    let reversedRules = this.getRuleTypeCheckRules();
    let program =
      "{\n  " +
      lhs.closed(false).toStr() +
      ".\n\n" +
      Rule.toStrMulti(reversedRules, "  ") +
      "}.\n";
    program += "goal@@ " + `{${this.start.closed(false).toStr()}, @p} :- .`;
    // console.error("----- Generated Program -----\n"+program);
    let slimout = Util.runSlimNd(program);
    // console.error("----- SLIM Output -----\n"+slimout);
    let paths = Util.parseTransitions(slimout);
    // console.error(paths);
    let states = Util.parseStates(slimout);
    // console.log(paths);
    for (let i = 0; i < paths.length; i++) {
      let path = paths[i];
      // console.log("PATH #"+i+"\n"+states[1]);
      for (let trans of path) {
        if (trans.rule === -1) continue;
        let rule = reversedRules[trans.rule];
        let origin = rule.origin;
        let set = rule.set;
        let coset = rule.coset;
        // console.log("---------- RevRule ----------");
        // console.log(`rule   : ${rule.toStr()}`);
        // console.log(`origin : ${origin.toStr()}`);
        // console.log(`set    : ${set.toStr()}`);
        // console.log(`coset  : ${coset.toStr()}`);
        // console.log("-----------------------------");
        // console.log(states[trans.to]);
      }
      // console.log("");
    }
    let ret: string[] = [];
    for (let i = 0; i < paths.length; i++) {
      let path = paths[i].concat([]);
      let graphs = [this.start.closed(false).toStr() + "."];
      // console.log("PATH #"+i);
      // console.log(this.start.closed(false).toStr());
      while (path.length > 0) {
        const undefCheck = <T>(p: T | undefined) => {
          if (p === undefined)
            throw new Error("Unexpected Error: undefined value");
          else return p;
        };
        let rule = undefCheck(path.pop()).rule;
        if (rule === -1) continue;
        let origin = undefCheck(reversedRules[rule].origin);
        graphs = Util.runOneStepNdMulti(graphs, origin);
        // console.log(`${origin.name}@@ --> ${graphs}`);
      }
      Array.prototype.push.apply(ret, graphs);
    }
    return ret;
  }

  // ルール型検査のためのルールセットを生成
  getRuleTypeCheckRules(): Rule[] {
    let rules = Rule.getReversedMulti(this.rules);
    let origins = (<Rule[]>[]).concat(this.rules);
    let ret: Rule[] = [];
    for (let rule of rules) {
      let lhss = rule.lhs.getPowerSet();
      let origin = origins.shift();
      if (origin === undefined) throw new Error("origin not Found");
      // console.error(rule.toStr()+"\t"+rule.lhs.atoms.length+"\t"+lhss.length)
      for (let i = 0; i < lhss.length; i++) {
        let lhs = lhss[i][0].copy();
        let rhs = rule.rhs.copy();
        let newRule = new Rule(lhs, new Guard(), rhs, "rule" + ret.length);
        let lfl = Link.difference(lhs.getFreeLinks(), rhs.getFreeLinks());
        let rfl = Link.difference(rhs.getFreeLinks(), lhs.getFreeLinks());

        for (let link of lfl) {
          newRule.lhs.push(Atom.getFreeAtomFromLink(link));
        }
        for (let link of rfl) {
          newRule.rhs.push(Atom.getFreeAtomFromLink(link));
        }
        newRule.set = lhss[i][0];
        newRule.coset = lhss[i][1];
        newRule.origin = origin;
        ret.push(newRule);
      }
    }
    return ret;
  }

  ruleTypeCheck2Rules: undefined | Rule2[]; // メモ化
  // ルール型検査2のためのルールセットを生成
  getRuleTypeCheck2Rules(): Rule2[] {
    if (this.ruleTypeCheck2Rules !== undefined) return this.ruleTypeCheck2Rules;
    let rules = Rule.getReversedMulti(this.rules);
    let origins = (<Rule[]>[]).concat(this.rules);
    let ret: Rule2[] = [];
    for (let rule of rules) {
      let lhss = rule.lhs.getPowerSet();
      let origin = origins.shift();
      // console.error(rule.toStr()+"\t"+rule.lhs.atoms.length+"\t"+lhss.length)
      for (let i = 0; i < lhss.length; i++) {
        let newRule = Rule2.make(
          lhss[i][0].copy(),
          lhss[i][1].copy(),
          rule.rhs.copy(),
          `rule${ret.length}`
        );
        ret.push(newRule);
      }
    }
    return (this.ruleTypeCheck2Rules = ret);
  }

  async ruleTypeCheck8(rule: Rule): Promise<boolean> {
    const str = readFileSync(
      `${__dirname}/../lmntal/rule_type_checking4.lmn`,
      "utf8"
    );
    const initGraph = `// ==========
rules={
${Rule8.toStrMulti(this.getRuleTypeCheck8Rules())}
},
init={
  ${this.getRuleTypeCheck8InitGraph(rule)}
},
start={${new Graph([this.start]).closed(false).toStr()}},
reversedRules={
${Rule8.toStrMulti(Rule.getReversedWithConstraintsMulti(this.rules))}
},
eliminateRules={
${Rule8.toStrMulti(this.getEliminateRules())}
}.`;

    const input = `// Target Rule: ${rule.toRawStr()}\n${str}${initGraph}`;
    return await Util.runSlimAndZ3(input);
  }

  getRuleTypeCheck8InitGraph(rule: Rule) {
    const lhs = rule.lhs.copy();
    const rhs = rule.rhs.copy();
    const lhs_pcs = lhs.getProcessContexts();
    const rhs_pcs = rhs.getProcessContexts();

    let proxy_arr = [] as string[];
    for (const pc of lhs_pcs) {
      const l = Link.getNewIDLink();
      lhs.replace(pc, l);
      proxy_arr.push(`{${l.toStr()}=proxy}`);
    }
    for (const pc of rhs_pcs) {
      const l = Link.getNewIDLink();
      rhs.replace(pc, l);
      proxy_arr.push(`{${l.toStr()}=proxy}`);
    }
    // rule(0,{${rule.lhs.toStr()}},{${rule.rhs.toStr()}},{})
    return `rule({${lhs.toStr()}},{${rhs.toStr()}},{${proxy_arr.join(",")}})`;
  }

  async graphTypeCheck2(graph: Graph){
    const str = readFileSync(
      `${__dirname}/../lmntal/graph_type_checking.lmn`,
      "utf8"
    );
    const initGraph = `// ==========
ret=reduce({${this.getRuleTypeCheck8InitGraph(new Rule(new Graph([this.start]).closed(false), new Guard(), graph, "init"))}}).
reversedRules={
${Rule8.toStrMulti(Rule.getReversedWithConstraintsMulti(this.rules))}
},
eliminateRules={
${Rule8.toStrMulti(this.getEliminateRules())}
}.`;
    const input = `// Target Graph: ${graph.toRawStr()}\n${str}${initGraph}`;
    return await Util.runSlimAndZ3(input);
  }

  ruleTypeCheck8Rules: undefined | Rule8[]; // メモ化
  // ルール型検査8のためのルールセットを生成
  getRuleTypeCheck8Rules(): Rule8[] {
    if (this.ruleTypeCheck8Rules !== undefined) return this.ruleTypeCheck8Rules;
    let rules = Rule.getReversedMulti(this.rules);
    let origins = ([] as Rule[]).concat(this.rules);
    let ret: Rule8[] = [];
    for (let rule of rules) {
      // console.log(rule.toStr());
      let lhss = rule.lhs.getPowerSet();
      let origin = origins.shift();
      // console.error(rule.toStr()+"\t"+rule.lhs.atoms.length+"\t"+lhss.length)
      for (let i = 0; i < lhss.length; i++) {
        let newRule = Rule8.make(
          lhss[i][0].copy(),
          lhss[i][1].copy(),
          rule.rhs.copy(),
          rule.guard,
          `rule${ret.length}`
        );
        ret.push(newRule);
      }
    }
    return (this.ruleTypeCheck8Rules = ret);
  }

  getEliminateRules(): Rule8[] {
    let fs = this.getAllFunctors();
    let rules = [] as Rule8[];
    for (const f of fs) {
      // global connector
      if (f[0] === "'='") {
        rules.push(new Rule8(
          "rule({{+X,+Y},$p[|*A]},{{+X,+Y},$q[|*B]},{$r[|*C]})",
          "",
          "rule({$p[|*A]},{$q[|*B]},{$r[|*C]})",
          "elim_conn"
        ));
        continue;
      }
      for (let i = 0; i < 1 << f[1]; i++) {
        let lhs = [] as Link[];
        let rhs = [] as Link[];
        let lhsf = [] as Link[];
        let rhsf = [] as Link[];
        for (let k = 0; k < f[1]; k++) {
          if ((i >> k) % 2 === 1) {
            // 相互接続
            const l = Link.getNewIDLink();
            lhs.push(l);
            rhs.push(l);
          } else {
            const l = Link.getNewIDLink();
            const r = Link.getNewIDLink();
            lhs.push(l);
            rhs.push(r);
            lhsf.push(l);
            rhsf.push(r);
          }
        }
        rules.push(
          new Rule8(
            `rule({${f[0]}(${Link.toStrMulti(lhs)}),$p[${Link.toStrMulti(
              lhsf
            )}|*A]},{${f[0]}(${Link.toStrMulti(rhs)}),$q[${Link.toStrMulti(
              rhsf
            )}|*B]},{$r[|*C]})`,
            ``,
            `rule({$p[${Link.toStrMulti(lhsf)}|*A]},{$q[${Link.toStrMulti(
              lhsf
            )}|*B]},{$r[|*C]})`,
            `elim_${f[0]}_${i}`
          )
        );
      }
    }
    return rules;
  }

  getAllFunctors() {
    let ret = new Set<[string, number]>();
    for (const rule of this.rules) {
      let res = rule.getAllFunctors();
      for (const f of res) {
        ret.add(f);
      }
    }
    return ret;
  }
}
