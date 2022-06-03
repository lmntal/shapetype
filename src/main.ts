import * as fs from "fs";
import { ShapeType } from "./shapetype";
import { Graph } from "./graph";
import { Rule, Rule2 } from "./rule";
import { Util } from "./util";

function fileInput(file: string): string {
  try {
    fs.statSync(file);
  } catch (e) {
    throw new Error(`File Not Found: ${file}`);
  }
  // コメントアウトと改行も処理する
  return fs
    .readFileSync(file, "utf8")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*.*\*\//gm, "")
    .replace(/%.*$/gm, "")
    .replace(/\n+/gm, " ")
    .trim();
}

function loadSettings() {
  const file = "settings.json";
  try {
    fs.statSync(file);
  } catch (e) {
    console.error("Path settings are missing: " + file);
    return false;
  }
  let data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (data.lmntal === undefined) {
    console.error("LMNtal Path setting is missing: " + file);
    return false;
  }
  if (data.slim === undefined) {
    console.error("SLIM Path setting is missing: " + file);
    return false;
  }
  if (data.useNcore === undefined) {
    data.useNcore = 1;
  }
  if (data.verbose !== undefined) {
    Util.verbose = data.verbose;
  }
  ShapeType.initPaths(data.lmntal, data.slim, data.useNcore);
  return true;
}

function parseAndGraphTypeCheck(typeInput: string, graphInput: string) {
  let type: ShapeType, graph: Graph;
  try {
    type = ShapeType.parse(typeInput);
    graph = Graph.parse(graphInput, false);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  Util.log("===== Graph Type Checking =====", 1);
  Util.log("----- Target Graph -----\n" + graph.toRawStr(), 1);
  Util.log("----- Target ShapeType -----\n" + type.toRawStr(), 1);
  let res = type.graphTypeCheck(graph);
  Util.log("----- Result -----", 1);
  if (res.length === 0) {
    Util.log("false", 0);
  } else {
    for (let r of res) {
      Util.log("G : " + type.name + "(" + r.join(",") + ")", 0);
    }
  }
}

async function parseAndGraphTypeCheck2(typeInput: string, graphInput: string) {
  let type: ShapeType, graph: Graph;
  try {
    type = ShapeType.parse(typeInput);
    graph = Graph.parse(graphInput, false);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  Util.log("===== Graph Type Checking =====", 1);
  Util.log("----- Target Graph -----\n" + graph.toRawStr(), 1);
  Util.log("----- Target ShapeType -----\n" + type.toRawStr(), 1);
  let res = await type.graphTypeCheck2(graph);
  Util.log("----- Result -----", 1);
  Util.log(`${res}`, 0);
  // if (res.length === 0) {
  //   Util.log("false", 0);
  // } else {
  //   for (let r of res) {
  //     Util.log("G : " + type.name + "(" + r.join(",") + ")", 0);
  //   }
  // }
}

declare const nev: never;
function getRuleTypeCheck(
  version: number,
  type: ShapeType
): (rule: Rule) => Promise<boolean> {
  switch (version) {
    case 1:
      return async (r) => type.ruleTypeCheck(r);
    case 2:
      return async (r) => type.ruleTypeCheck2(r);
    case 3:
      return async (r) => type.ruleTypeCheck3(r);
    case 8:
      return async (r) => await type.ruleTypeCheck8(r);
    default:
      return nev;
  }
}

async function parseAndRuleTypeCheck(
  version: 1 | 2 | 3 | 8,
  typeInput: string,
  ruleInput: string
) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  for (let rule of rules) {
    Util.log("===== Rule Type Checking =====", 1);
    Util.log("----- Target Rule -----\n" + rule.toRawStr(), 1);
    Util.log("----- Target ShapeType -----\n" + type.toRawStr(), 1);
    let func = getRuleTypeCheck(version, type);
    let res = await Util.measureAsync(func, rule);
    Util.log("----- Elapsed Time -----", 1);
    Util.log(`${res.elapsed_ms} [ms]`, 1);
    Util.log("----- Result -----", 1);
    Util.log(res.returnValue.toString(), 0);
  }
}

function printLMNtalCode(typeInput: string, ruleInput: string) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  const rule = rules[0];
  const str = fs.readFileSync(
    `${__dirname}/../lmntal/rule_type_checking.lmn`,
    "utf8"
  );
  const initGraph = `res=run({
${Rule2.toStrMulti(type.getRuleTypeCheck2Rules())}
},{
  head{${rule.lhs.toStr()}},body{${rule.rhs.toStr()}}
}).
reversedRules({
${Rule.toStrMulti(Rule.getReversedMulti(type.rules), "  ")}}).`;

  console.log(`// Target Rule: ${rule.toRawStr()}`);
  console.log(str + initGraph);
}

function printLMNtalCode2(typeInput: string, ruleInput: string) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  const rule = rules[0];
  const str = fs.readFileSync(
    `${__dirname}/../lmntal/rule_type_checking2.lmn`,
    "utf8"
  );
  const initGraph = `// ==========
rules={
${Rule2.toStrMulti(type.getRuleTypeCheck2Rules())}
},
init={
  head{${rule.lhs.toStr()}},body{${rule.rhs.toStr()}}
},
reversedRules={
${Rule.toStrMulti(Rule.getReversedMulti(type.rules), "  ")}}.`;

  console.log(`// Target Rule: ${rule.toRawStr()}`);
  console.log(
    str + initGraph.replace(/head{(.*?)},body{(.*?)}/g, "rule({$1},{$2})")
  );
}

function printLMNtalCode3(typeInput: string, ruleInput: string) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  const rule = rules[0];
  const str = fs.readFileSync(
    `${__dirname}/../lmntal/rule_type_checking3.lmn`,
    "utf8"
  );
  const initGraph = `// ==========
rules={
${Rule2.toStrMulti(type.getRuleTypeCheck2Rules())}
},
init={
  head{${rule.lhs.toStr()}},body{${rule.rhs.toStr()}}
},
start={${new Graph([type.start]).closed(false).toStr()}},
reversedRules={
${Rule.toStrMulti(Rule.getReversedMulti(type.rules), "  ")}}.`;

  console.log(`// Target Rule: ${rule.toRawStr()}`);
  console.log(
    // initGraph
    str + initGraph
      .replace(/head{(.*?)},body{(.*?)} :-/g, "rule({$1},{$2}) :-")
      .replace(/head{(.*?)},body{(.*?)}\./g, "rule({$1},{$2}).")
      .replace(/head{(.*?)},body{(.*?)}$/g, "rule({$1},{$2})")
  );
}

function printStateNumber(typeInput: string, ruleInput: string) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  for (const rule of rules) {
    let reversedRules = type.getRuleTypeCheckRules();
    let program =
      rule.lhs.closed(false).toStr() +
      ".\n\n" +
      Rule.toStrMulti(reversedRules, "  ");
    let slimout = Util.runSlim(program, { slim: ["--nd"] });
    let str = slimout.split("\n").slice(-3).slice(0, 1).join();
    let num = parseInt(
      str.replace("'# of States'(stored)   = ", "").slice(0, -1)
    );
    console.log(`|${rule.name}|${num}|`);
  }
}

function measureRuleTypeChecks(typeInput: string, ruleInput: string) {
  let type: ShapeType, rules: Rule[];
  try {
    type = ShapeType.parse(typeInput);
    rules = Rule.parseMulti(ruleInput);
  } catch (e:any) {
    console.error(e.toString());
    return;
  }
  const round = (n: number, digit: number) => {
    let m = Math.pow(10, digit);
    return Math.round(n * m) / m;
  };
  for (let rule of rules) {
    for (let i = 1; i <= 3; i++) {
      const res = Util.measure(getRuleTypeCheck(i, type), rule);
      Util.log(
        `ver.${i} returns ${res.returnValue} (elapsed: ${round(
          res.elapsed_ms,
          3
        )} ms)`,
        0
      );
    }
  }
}

const f = async () => {
  if (!loadSettings()) return;
  let mode = process.argv[2];
  const input = (n: number) =>
    n === 4 && process.argv.length === 4
      ? require("fs").readFileSync("/dev/stdin", "utf8")
      : fileInput(process.argv[n]);
  switch (mode) {
    case "graph1":
      parseAndGraphTypeCheck(input(3), input(4));
      break;
    case "graph":
    case "graph2":
      parseAndGraphTypeCheck2(input(3), input(4));
      break;
    case "rule1":
      await parseAndRuleTypeCheck(1, input(3), input(4));
      break;
    case "rule2":
      await parseAndRuleTypeCheck(2, input(3), input(4));
      break;
    case "rule3":
      await parseAndRuleTypeCheck(3, input(3), input(4));
      break;
    case "rules":
      measureRuleTypeChecks(input(3), input(4));
      break;
    case "rule4":
      printLMNtalCode(input(3), input(4));
      break;
    case "rule5":
      printLMNtalCode2(input(3), input(4));
      break;
    case "rule6":
      printStateNumber(input(3), input(4));
      break;
    case "rule7":
      printLMNtalCode3(input(3), input(4));
      break;
    case "rule":
    case "rule8":
      await parseAndRuleTypeCheck(8, input(3), input(4));
      break;
    case "test":
      let s = ShapeType.parse(input(3));
      console.log(s.toStr());
      console.log(s.isExtensive());
      // console.log(Rule2.toStrMulti(s.getRuleTypeCheck2Rules()));
      // console.log(s.reduce(Graph.parse("z(I_26),sl(L3,I_27,I_29,I_26),e(L4,I_28,L3,I_27),e(L0,L1,L4,I_28),s(L2,I_29), s(s(z),L2)"),Graph.parse("z(L5),sl(L0,L1,I_25,L2),s(L5,I_25), s(s(z),L2)")))

      // const f = (a:string,b:string)=>Graph.parse(a).equals(Graph.parse(b))
      // console.log(f("n_z(n_sl(L3,n_e(L4,n_e(L0,L1,L4),L3),L2))","n_z(n_sl(L3,n_e(L4,n_e(L0,L1,L4),L3),L2))"));
      // console.log(f("n_c(L0,L5). n_z(L6). n_sl(L5,L1,L6,L2)","n_c(L0,L5). n_z(L6). n_sl(L5,L1,L6,L2)"));
      // console.log(f("a(X)","a(X)"));
      break;
    default:
      console.error("Unknown option: " + mode);
  }
};

f().catch((e) => console.error(e));
