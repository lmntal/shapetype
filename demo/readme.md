# LMNtal ShapeTypeの例題一覧
[各例題のコードはGitLab上にある](https://gitlab.ueda.info.waseda.ac.jp/yamamoto/shapetype/-/tree/master/demo)。
タイトルに特記のないかぎり文脈自由な型。

## adlist：差分リストを保持するアトム
差分リスト（dlist/2）の両端を保持するa/3アトム。
「差分リストの後ろ」問題のテスト用例題。
以下のように差分リストの後ろ側を弄るルールはfalse-negativeとなる。
```prolog
a(X,M,R), c(M,Y) :- a(X,Y,R). % false-negative
a(X,M,R), c(M,Y) :- a(c(X),M,R), c(M,Y). % false-negative
```
これはadmissible ruleの導入によっては解決せず、むしろ前側を弄るルールもfalse-negativeとなってしまう。
解決するには、型のヒントを与えると良い。
```prolog
a(X,M,R), c(M,Y), dlist(X,Y) :- a(X,Y,R), dlist(X,Y). % with hint
```

## ambiguous：曖昧な文法
曖昧なCFG `A ::= A plus A | a` （i.e. 同じ文字列の導出系列が複数通りありうる） を表す型。

以下のルールはfalse-negativeとなる。
```prolog
R=a(plus(a(L))) :- R=a(L)
```
[詳細は日誌にある](https://www.ueda.info.waseda.ac.jp/lmntal/local/index.php?yamamoto/M2%E6%97%A5%E8%AA%8C#a93beeeb)が、（左辺で潰した）状態空間上において開始記号に至る経路上に自己ループが存在することが原因。

曖昧でない文法で書き直したバージョンがnotamb。

## aplas2019：整合的な型による赤黒木の表現
zero, successorで黒高さを表現した赤黒木。

以下のルールの型検査は停止しない：
```prolog
b(L,l,P) :- b(L,r(l,l),P)
```

## append：関数的アトムappend/3により拡張された型
以前のプロトタイプではコネクタが書けなかったが、書けるように改良したのでappendのルールは2本とも検査可能になった。

## append510：整合的な型による長さ10,5のリストのappend
本質的な生成規則は次である：
```prolog
R=list10 :- R=append(list5,list5).
```
ただ、これは「定数による数値制約」の例になっているので、全通りの添字について非終端記号を立ててやれば、文脈自由な型で書ける。
インデックス型を使って書くことも出来るが、現状では開始記号に添字を書けないので、「任意の長さのリストと任意の長さのリストをappend」しか書けないのであまり意味がない。

## bintree：素朴な2分木
ルール例として木の回転が入っている

## dlist：差分リスト
プロトタイプには、論文で書いているようなε除去の仕組みが入っていないので、まだ空の差分リストは扱えない。

## evenlist：長さが偶数のリスト
これは「定数による数値制約」のもっとも簡単な例なので、文脈自由な型で表現可能。

## fastener：関数的アトムfastener
関数的アトムf/4は第1引数に差分リストの先頭、第2引数にその末尾、第3引数にbooleanを受け取り、第4引数にリストを吐き出す。
第3引数がtrueのときは差分リストの先頭から、falseのときは末尾から要素を取り出し、第3引数を反転する。
これを繰り返すことにより、（ファスナーを締めるように）先頭と末尾から交互に要素を取り出してリストに変換する。

adlistと同様、型のヒントを与えないとfalse-negativeとなる。
```prolog
R=f(c(Z),Y,t) :- R=c(f(Z,Y,f)). % false-negative
R=f(X,Y,f), c(Y,Z) :- R=c(f(X,Z,t)). % false-negative
R=f(c(dlist(Y)),Y,t) :- R=c(f(dlist(Y),Y,f)). % with hint
R=f(dlist(c(Y)),Y,f) :- R=c(f(dlist(Y),Y,t)). % with hint
```

## firewall：CEGAR論文のfirewall例題
[CEGAR論文](https://doi.org/10.1007/11691372_13)に出てくるfirewallの例題をFlatLMNtalにエンコードした上で、ShapeTypeで表現したもの。

ハイパーリンクを表すために、joint/2アトムを導入する。
第1引数には接続されているLやCのリスト、第2引数にはUPやSPのリストをつなぐ。
これらのリストの順序は勝手に入れ替えてよく（本質的には0-step rule）、元のfirewallのルール適用にあたっては、（たまたま）リストの先頭にきたものだけを考える。

これで一応型とルールは書けたが、生成規則右辺が大きすぎる（最大でアトム数19個）ので、生成される逆実行用ルールが膨大（2^19 over）となり、そもそもコンパイルできない。

## iamb：本質的に曖昧な言語
本質的に曖昧な言語（Inherently ambiguous language, 曖昧でない文法によって表現できないような言語）の典型例 `{a^i b^j c^k | i=j \/ j=k }` を表す型。だが、これを保存するような面白いルールは見つかっていない。

例えば、ab を aabb に書き換えるようなルールはこの型を保存しない。abbcc (well-typed) が aabbbcc (ill-typed) になってしまう。 このように、左辺が a,b,c のうち1種のみや2種のみからなる場合であって、かつ右辺が左辺と構造合同でないルールはいずれも型を保存しない（ハズ）。

一方で、例えば abc を aabbcc に書き換えるルールは当然型を保存するが、元々のbの個数が1と決まってしまうので、あまり面白くない。

## indexedbst：インデックス型による二分探索木
インデックス型は、卒論で提案した基本型（の一部）と本質的には一緒なので、インデックス型が入れば基本型でやろうとしていたこともできる。つまり、「要素としてint型をもつようなグラフ型」を取り扱える。またその要素間の制約も記述可能。

その典型例が二分探索木である。
「無限大」を定数として記述できないため、若干冗長な型定義となっているが、本質的には生成規則3本で書ける。

木の回転を表す以下のルールは型を保存する（正常に判定）：
```prolog
node($y,node($x,A,B),C,R) :- node($x,A,node($y,B,C),R). % R rotate
node($x,A,node($y,B,C),R) :- node($y,node($x,A,B),C,R). % L rotate
```

## indexedrbtree：インデックス型による赤黒木の表現
以下のルールは型を保存する（正常に判定）：
```prolog
b(S,leaf,R) :- b(S,r(leaf,leaf),R). % simple insertion
b(A,B,R) :- b(B,A,R). % flip
```

## indexedrbfunc, indexedrbfuncinfrared, indexedrbfunctree：インデックス型による赤黒木に対する回転を伴う挿入を行う関数的アトム
rbfunc, rbfuncinfrared, rbfunctreeのインデックス型バージョン。現状では1ルールあたり最大で25分程度を要する場合もあるが、なんとか正常に型保存の判定はできている。[実験結果](https://www.ueda.info.waseda.ac.jp/lmntal/local/index.php?yamamoto/M2%E6%97%A5%E8%AA%8C#pd471af8)

## list：線形リスト
以下はルールでマッチするグラフが非連結である例だが、false-negativeとなる：
```prolog
c(c(XL),XR),c(YL,YR) :- c(c(YL),YR), c(XL,XR). % false-negative
```
これは、2つの部分をつなぐ「差分リスト」が推論できないという意味で、「差分リストの後ろ」と同種の問題。

## mesh：整合的な型による2次元グリッドグラフ
[生まれた経緯等の詳細は日誌にある](https://www.ueda.info.waseda.ac.jp/lmntal/local/index.php?yamamoto/M1%E6%97%A5%E8%AA%8C#wfc5bb3d)。
ルールの型検査は未着手だが、グラフの型検査ですらこの型の場合は時間がかかる（状態空間が膨大）。
同じ日誌のすぐ下にある、先生が定義したバージョンのほうが生成順が一意なので状態空間は小さくて済むが、いずれにしてもそもそも面白いルールが思いつかない。

思いついたとしても、生成順と相反するようなルール（生成がタテに進むなら、ヨコにまたがるもの）はおそらく検査が難しい。

## notamb：ambiguousの曖昧でない文法による表現
曖昧な文法の例題 ambiguous は本質的には曖昧でないので、曖昧でない文法に書き直したもの。

しかし、これもまた以下のルールでfalse-negativeとなる：
```prolog
a(plus(a(L)),R) :- a(L,R).
```

[詳細は日誌にある](https://www.ueda.info.waseda.ac.jp/lmntal/local/index.php?yamamoto/M2%E6%97%A5%E8%AA%8C#l2c977ed)が、状態空間の枝刈りがうまくいっていないために、本当は開始記号にたどり着けないような経路まで探索対象に入れてしまっていることが原因。

## ntokens：n個のトークンを含むリスト
パラメタを含む型（開始記号）の例。実装は未対応のはずだが、うまく行ってしまっているようにみえる。要検証。

## rbfunc, rbfuncinfrared, rbfunctree：赤黒木（黒高さ制約なし）に対する回転を伴う挿入を行う関数的アトム
黒高さの制約を外して文脈自由にした赤黒木の型に対して、関数的アトムにより挿入操作を行う例。1ルールあたり最大43秒・メモリ16GBを要する場合もあるが、ひとまず検査はできている。[実験結果](https://www.ueda.info.waseda.ac.jp/lmntal/local/index.php?yamamoto/M2%E6%97%A5%E8%AA%8C#n5f5b0cf)

[docs/algorithm](https://gitlab.ueda.info.waseda.ac.jp/yamamoto/shapetype/-/blob/master/docs/algorithms/algorithms.pdf)の第2節も参照。balanceのルールが無駄に多いのは、LMNtalにelseがないのが原因。

## rbtree：黒高さ制約なしの赤黒木
黒高さの制約を外して文脈自由にした赤黒木の型。吉元さんの卒論のrunning exampleでもある。

## rbtree3：黒高さ3までの赤黒木
「定数による数値制約」の例として、全通りの添字について非終端記号を立てて、黒高さ3までの赤黒木を文脈自由な型で表現したもの。

## ring：c/2アトムからなるリング
以下のうち、上のルールは上手くいくが、下はうまく行かない：
```prolog
c(X,Y) :- c(c(X),Y). % ok
c(c(X),Y) :- c(X,Y). % false-negative
```
これは、`ring(X,Y) :- c(X,Y)`の逆適用により、左辺が`ring(ring(X),Y)`となった場合、実際にはここから開始記号にはたどり着けないが、reducibleでないのでfalseを返してしまうことによる。

## sensitive：整合的な型による葉をペアにした二分木
二分木を生成してから、その葉を2つとってペアにしたもの。
整合的な型の例として人工的に作った例題なので、あまり面白くはない。

## sensitive2：（弱）文脈依存言語
`{ a^n b^n c^n | n>=0 }` は文脈自由文法で表現不可能な典型例だが、文脈自由な型で表現可能。
ただ、これを保存するような面白いルールは思いつかない。

## skip3：整合的な型による、連続で通過できるのが3駅までのスキップリスト
先生に発掘してもらった、吉元さん時代の例題。
ただ、これは「定数による数値制約」の例なので、文脈自由な型でも表現可能（skip3cf）。

## skiplist：スキップリスト
単純な2レベルスキップリスト。

## sortedlist：インデックス型によるソート済みの整数リスト
indexedbstと同様、インデックス型を要素型がintであるデータ構造とその要素間の制約に応用したものだが、以下の例が *false-positive* となってしまっている：
```prolog
c($n,c($m,R)) :- c($m,c($n,R)). % false-positive
```

そもそもreducibilityの検査が一度も走っていないので、初期グラフが直接intとつながっている場合の実装のバグだと思う。要検証。

## t2l：二分木を中間順に走査し差分リストを吐き出す関数的アトムt2l/3
「空の差分リスト」問題まわりを無視すれば、正常に検査可能。ただし、admissible ruleとして以下が必要：
```prolog
dlist(X,Y) :- dlist(X,M),dlist(M,Y).
```

## threaded：Threaded Trees


## token1：トークンを1つだけ含むリスト
「トークンを右に動かしてもトークンの数は常に1つ」

## token2：名前付きトークンを2つ含むリスト
「トークンを右に動かしてもトークンの順序は入れ替わらない」

## tokenlist：名前付きトークンをn個含むリスト
token2の一般化。「トークンを右に動かしてもトークンの順序は入れ替わらない」は検査できているように見えるが、おそらくsortedlistと同様の理由で、以下のルールが *false-positive* となってしまっている。
```prolog
R=c(X,c(Y,L)) :- R=c(Y,c(X,L)).
R=c($x,c($y,L)) :- R=c($y,c($x,L)).
```

## tokenring：トークンを1つだけ含むリング
adlistと同様の理由で、型のヒントを与えないとfalse-negativeになる。

```prolog
R=t(n(L)) :- R=n(t(L)). % false-negative
X=ns(t(n(X))) :- X=ns(n(t(X))). % with hint
```

## tokenring3：トークンを3つ含むリング
「定数による数値制約」として文脈自由な型で表現。
これもadlistと同様の理由で、型のヒントを与えないとfalse-negativeになる。

```prolog
R=t(n(L)) :- R=n(t(L)). % false-negative
R=t(n(tokenring2(R))) :- R=n(t(tokenring2(R))). % with hint
```
