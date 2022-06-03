import { ShapeType } from "./shapetype";
import { Rule, Rule2 } from "./rule";
import { execSync, spawn } from "child_process";
import { performance } from "perf_hooks";
import { v4 as uuidv4 } from "uuid";
import { fstat, writeFileSync } from "fs";
import * as readline from "readline";
import { parse } from "path";
import { Constraint } from "./guard";

export class Util {
  // 0:quiet 1:最重要のみ 2:重要以上 3:ふつう以上 4~:全部
  static verbose = 2;

  // level 0:最重要 1:重要 2:ふつう 3:未指定
  // 0: 最終結果
  // 1: 実行時情報
  // 2: SLIM I/O
  static log(str: string, level?: number) {
    const l = level === undefined ? 3 : level;
    if (Util.verbose > l) {
      console.log(str);
    }
  }

  static runSlim(
    input: string,
    options: { lmntal?: string[]; slim?: string[] }
  ) {
    const f = (opt: string[] | undefined) =>
      opt === undefined ? "" : opt.join(" ");
    Util.log("===== INPUT ====\n" + input, 2);
    let il = execSync(
      `${ShapeType.lmntal} ${f(options.lmntal)} --stdin-lmn --slimcode -O3`,
      { input: input }
    );
    let slimout = execSync(
      `${ShapeType.slim} ${f(options.slim)} --use-Ncore=${
        ShapeType.useNcore
      } --hide-ruleset -`,
      { input: il }
    ).toString();
    Util.log("===== OUTPUT ====\n" + slimout, 2);
    return slimout;
  }

  static runSlimNd(input: string) {
    return this.runSlim(input, { slim: ["--nd", "-t", "--show-transition"] });
  }

  static runOneStep(graph: string, rule: Rule) {
    return this.runSlim(graph + "\n" + rule.guardAddedString("uniq"), {});
  }

  static runSlimAndZ3(input: string) {
    return new Promise<boolean>((resolve, reject) => {
      console.log(input);
      const filename = `/tmp/${uuidv4()}.il`;
      execSync(`${ShapeType.lmntal} --stdin-lmn --slimcode -O3 > ${filename}`, {
        input: input,
      });
      // console.log(filename);
      const slim = spawn(ShapeType.slim, ["--use-builtin-rule", filename]);
      const rl = readline.createInterface({
        input: slim.stdout,
        output: slim.stdin,
      });
      slim.stderr.on("data", (line) => {
        console.error(`error: ${line}`);
      });

      let pre = [] as Constraint[];
      let post = [] as Constraint[];
      let buf = [] as Constraint[];
      rl.on("line", (line) => {
        console.log(`received: ${line}`);
        line = line.trim();
        if (line === "") return;
        if (line.startsWith("{")) {
          if (line.indexOf("true(ret).") !== -1) resolve(true);
          else if (line.indexOf("false(ret).") !== -1) resolve(false);
          // else reject(line);
          return;
        }
        if (line.startsWith("Z3QUERY:")) {
          const query = line.substr(8);
          switch (query) {
            case "IF":
              buf = [];
              break;
            case "THEN":
              pre = buf;
              buf = [];
              break;
            case "FI":
              post = buf;
              buf = [];
              let ret = Constraint.getAllVariablesMulti(pre);
              let res = Constraint.getAllVariablesMulti(post);
              for (const r of res) {
                ret.add(r);
              }
              const vs = [...ret];
              const pyinput = `python -c 'from z3 import *; ${vs.join(
                ","
              )}=Ints("${vs.join(" ")}"); s=Solver(); s.add(ForAll([${vs.join(
                ","
              )}],Implies(And(${Constraint.getZ3ConditionMulti(pre).join(
                ","
              )}),And(${Constraint.getZ3ConditionMulti(post).join(
                ","
              )})))); print s.check()'`;
              console.log(pyinput);

              let pyres = execSync(pyinput, { encoding: "utf8" });
              console.log(pyres.trim());

              if (pyres.trim() === "sat") slim.stdin.write("true\n");
              else slim.stdin.write("false\n");

              break;
            default:
              buf.push(Constraint.parse(query));
          }
        }
      });
      // setInterval(()=>{slim.stdin.write("true\n")},100)

      // slim.stdin.on("error",(e)=>{console.error(e)})
      // slim.stdout.on("error",(e)=>{console.error(e)})
      // slim.stderr.on("error",(e)=>{console.error(e)})
      slim.on("error", (e) => {
        console.log(e);
      });
      rl.on("error", (e) => {
        console.log(e);
      });

      // rl.on("line",(line)=>{
      //   console.log(`received: ${line}`)

      // })
      // rl.on("close",()=>{resolve(false)})
    });
  }

  static makeTempFile(input: string): string {
    const name = `/tmp/${uuidv4()}.il`;
    writeFileSync(name, input);
    return name;
  }

  static nullChecker(nullable: RegExpMatchArray | null) {
    if (nullable === null) throw new Error("Parse Error");
    else return nullable;
  }

  static parseOneStepNd(slimout: string) {
    const nc = this.nullChecker;
    let init = parseInt(nc(slimout.match(/^init:(\d+)$/m))[1], 10);
    let states = nc(
      nc(slimout.match(/^States[\s\S]+?\n\n/gm))[0].match(/^\d+::.*$/gm)
    );
    let ret: string[] = [];
    for (let state of states) {
      let data = state.match(/^(\d+)::{(.+?) }$/);
      let num: number, graph: string;
      if (data === null) {
        num = parseInt(nc(state.match(/^\d+/))[0]);
        graph = "";
      } else {
        num = parseInt(data[1]);
        graph = data[2];
      }
      if (num !== init) ret.push(graph);
    }
    // console.log(ret);
    return ret;
  }

  static runOneStepNd(graph: string, rule: Rule): string[] {
    return this.parseOneStepNd(
      this.runSlimNd(graph + "\n" + rule.guardAddedString("uniq"))
    );
  }

  static runOneStepNdMulti(graphs: string[], rule: Rule): string[] {
    let ret: string[] = [];
    for (let graph of graphs) {
      Array.prototype.push.apply(ret, Util.runOneStepNd(graph, rule));
    }
    return ret;
  }

  static runOneStepNd2(graph: string, rules: Rule2[]): string[] {
    return this.parseOneStepNd(
      this.runSlimNd(
        `token, ${graph}\n` +
          rules
            .map((r) => `${r.name}@@ token, ${r.lhs} :- ${r.guard} | ${r.rhs}.`)
            .join("\n")
      )
    );
  }

  static isCongruent(graph1: string, graph2: string) {
    const prog = `left{ ${graph1} },right{ ${graph2} }.\ncong@@ left{$p[|*A]},right{$q[|*B]} :- left{$q[|*B]},right{$p[|*A]}.`;
    try {
      const slimout = this.runSlim(prog, { slim: ["--nd"] });
      const stored = parseInt(
        this.nullChecker(
          slimout.match(/^'# of States'\(stored\)   = (\d+).$/m)
        )[1]
      );
      return stored === 1;
    } catch (e) {
      return false;
    }
  }

  static parseStates(slimout: string) {
    const nc = this.nullChecker;
    let res = slimout.match(/^States[\s\S]+?\n\n/gm);
    if (res === null) throw new Error("States not Found");
    let states = nc(res[0].match(/^\d+::.*$/gm));
    let ret: { [key: number]: string | null } = {};
    for (let state of states) {
      let data = state.match(/^(\d+)::{{(.+?)\. }\. }/);
      if (data === null) ret[parseInt(nc(state.match(/^\d+/))[0])] = null;
      else ret[parseInt(data[1])] = data[2];
    }
    return ret;
  }

  static parseTransitions(slimout: string) {
    const nc = this.nullChecker;
    let ret = slimout.match(/^Transitions[\s\S]+?\n\n/gm);
    if (ret === null) throw new Error("Transitions not Found");
    let init = parseInt(nc(slimout.match(/^init:(\d+)/m))[1]);
    let trs = nc(ret[0].match(/^\d+::.*$/gm));
    let trans: { [key: number]: { rule: number; to: number }[] } = {};
    let goalIDs: number[] = [];
    let goalTrans: { [key: number]: number[] } = {};
    for (let tr of trs) {
      let rs = tr.match(/\d+\(.+?\)/g);
      let fromID = parseInt(nc(tr.match(/^\d+/))[0]);
      if (trans[fromID] === undefined) trans[fromID] = [];
      if (rs === null) continue;
      for (let r of rs) {
        let arr = nc(r.match(/^(\d+)\((.+)\)/));
        let toID = parseInt(arr[1]);
        let rules = arr[2].split(" ");
        for (let rule of rules) {
          if (rule === "goal") {
            goalIDs.push(fromID);
            if (goalTrans[fromID] === undefined) goalTrans[fromID] = [toID];
            else goalTrans[fromID].push(toID);
            continue;
          }
          let ruleID =
            rule === "free" ? -1 : parseInt(nc(rule.match(/^rule(\d+)/))[1]);
          if (trans[fromID] === undefined) {
            trans[fromID] = [{ rule: ruleID, to: toID }];
          } else {
            trans[fromID].push({ rule: ruleID, to: toID });
          }
        }
      }
    }
    // console.log(goalIDs)
    return this.findPathsToGoals(init, trans, goalIDs, goalTrans, []);
  }

  static findPathsToGoals(
    cur: number,
    edges: { [key: number]: { rule: number; to: number }[] },
    goals: number[],
    goalTrans: { [key: number]: number[] },
    visited: number[]
  ): { rule: number; to: number }[][] {
    // console.log(edges)
    // console.log(cur)
    // console.log(visited)
    // もう見た
    if (visited.includes(cur)) {
      return [];
    }
    let ret: { rule: number; to: number }[][] = [];
    // ゴールの一歩手前
    if (goals.includes(cur)) {
      for (let goal of goalTrans[cur]) {
        // ret.push([{rule:-1,to:goal}]);
        ret.push([]);
      }
    }
    visited.push(cur);
    for (let next of edges[cur]) {
      let res = Util.findPathsToGoals(
        next.to,
        edges,
        goals,
        goalTrans,
        visited
      );
      for (let r of res) {
        r.unshift(next);
      }
      Array.prototype.push.apply(ret, res);
    }
    visited.pop();
    return ret;
  }

  static removePrefix(str: string) {
    return str.replace(/^.+?_/, "");
  }

  static measure<T, U>(
    f: (arg: T) => U,
    data: T
  ): { returnValue: U; elapsed_ms: number } {
    const startTime = performance.now(); // 開始時間
    const ret = f(data); // 計測する処理
    const endTime = performance.now(); // 終了時間
    return { returnValue: ret, elapsed_ms: endTime - startTime };
  }

  static async measureAsync<T, U>(
    f: (arg: T) => Promise<U>,
    data: T
  ): Promise<{ returnValue: U; elapsed_ms: number }> {
    const startTime = performance.now(); // 開始時間
    const ret = await f(data); // 計測する処理
    const endTime = performance.now(); // 終了時間
    return { returnValue: ret, elapsed_ms: endTime - startTime };
  }
}
