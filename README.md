# LMNtal ShapeType
This repository contains the prototype implementation of LMNtal ShapeType, a static type checking framework for a graph rewriting language LMNtal, which we presented in the paper "Engineering Grammar-based Type Checking for Graph Rewriting Languages".

## Preliminary
To run the prototype, you need to install Node.js and its package manager `npm`.
Also, you need to install z3py as an SMT-solver to handle numeric constraints on indexed types.

### Installing z3py
If `pip` is already installed, just run this:
```
pip install z3-solver
```

To check if z3py is successfully installed, try this command:
```bash
python -c 'from z3 import *; x,y=Ints("x y"); s=Solver(); s.add(x<y); print s.check(); print s.model()'
```

It's fine if you get the following result:
```
sat.
[x = 0, y = 1]
```

### Installation
Clone this repository and install the dependencies:
```bash
git clone <URL of this repository>
cd shapetype
npm i
```

Then, write PATH settings in ``settings.json``.

Example:
```json
{
  "lmntal":"/home/yamamoto/lmntal-compiler/bin/lmntal",
  "slim":"/home/yamamoto/slim/bin/slim",
  "verbose": 2
}
```

Note that `"verbose"` is an option indicating how the output should be detailed, which takes an integer value from 0 (quiet) to 4 (most verbose).

## How to run the test cases

```bash
./demo.sh <mode> <testcase>
```

Note that `<mode>` must be:
* `graph` (graph type checking), or
* `rule` (rule type checking)

The actual codes of the test cases are located under `demo/`:
* Type definition file: `demo/<testcase>_type.lmn`.
* Graph to be checked: `demo/<testcase>_graph.lmn`.
* Rule to be checked: `demo/<testcase>_rule.lmn`.

A brief description (in Japanese) of each `<testcase>` is available at `demo/readme.md`.

For example, try this command to perform rule type checking of a skip list:
```bash
./demo.sh rule skiplist
```

### Known issue about graph type checking and makeshift
The current implementation may not work well for graph type checking of indexed types. In this case, you can use rule type checking instead.

For example, if you want to check that the graph `R=b(b(r(l,l),l),b(l,l))` has the type `rbtree(R)`, you can run the rule type checking of this rule:
```
rbtree(R) :- R=b(b(r(l,l),l),b(l,l))
```

Note that this makeshift checking will not ensure that the target graph does not include nonterminal symbols, so you should check this manually.
Also, you need to specify the appropriate ordering of free links to use this makeshift, while the normal implementation of graph type checking finds the ordering automatically.

## Advanced Usage
```bash
node js/main.js <mode> <file1> <file2>
```
- `<mode>`: `graph` or `rule`. 
- `<file1>`: path to the file that contains the type definition
- `<file2>`: path to the file that contains the graph or rule (depending on the selected mode) to be checked

For example,
```bash
node js/main.js demo/skiplist_type.lmn demo/skiplist_rule.lmn
```
performs like
```bash
./demo.sh rule skiplist
```

Note that, if you made any changes to the source codes under `src` folder, you should run `make` command manually, whereas the `demo.sh` script automatically runs the transpiler.

## Details of each mode
### Graph type checking

```prolog
===== Graph Type Checking =====
----- Target Graph -----
node1(I_0,X),node1(L0,I_0),node2(L1,I_1,L0,Y),node2(I_2,I_3,L1,I_1),node1(L2,I_2),node2(L3,I_4,L2,I_3),node2(L4,I_5,L3,I_4),node2(I_6,I_7,L4,I_5),node1(L5,I_6),node2(I_8,I_9,L5,I_7),node1(L6,I_8),nil(L6,I_9)
----- Target ShapeType -----
ShapeType skiplist(List1,List2){
  prod0@@ skiplist(L1,L2) :- nil(L1,L2).
  prod1@@ skiplist(L1,L2) :- node1(X1,L1),skiplist(X1,L2).
  prod2@@ skiplist(L1,L2) :- node2(X1,X2,L1,L2),skiplist(X1,X2).
}nonterminals{
  skiplist(List1,List2)
}
----- Result -----
G : skiplist(X,Y)
```

If the graph has the type, it returns a list of free links (as the arguments of the type name) since the ordering of the free links does matter.

### Rule type checking

```prolog
===== Rule Type Checking =====
----- Target Rule -----
id3@@ node2(X1,Y1,X,Y),node2(X2,Y2,X1,Y1) :- node1(X1,X),node2(X2,Y2,X1,Y).
----- Target ShapeType -----
ShapeType skiplist(List1,List2){
  prod0@@ skiplist(L1,L2) :- nil(L1,L2).
  prod1@@ skiplist(L1,L2) :- node1(X1,L1),skiplist(X1,L2).
  prod2@@ skiplist(L1,L2) :- node2(X1,X2,L1,L2),skiplist(X1,X2).
}nonterminals{
  skiplist(List1,List2)
}
received: {true(ret). set(<set>). set_empty(cycle). start(94451569492576). map(<state_map>). state_count(3). max_depth(3). depth(1). state_sum(1,3). rules({@57. }). reversedRules({@58. }). eliminateRules({@59. }). @41. @43. @56. @61. }. @60. 
----- Elapsed Time -----
608.0396842956543 [ms]
----- Result -----
true
```
