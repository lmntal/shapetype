#!/bin/bash

type=rbfunctree
dir=logs/${type}-$(date +%Y%m%d-%H%M%S)

cd $(dirname $0)

tsc

mkdir -p $dir

cnt=0

grep -vE '^\s*%' demo/${type}_rule.lmn | grep -vE '^\s*$' | while read line
do
  cnt=$((cnt+1))
  echo $line
  # echo $line | time node js/main.js rule3 demo/${type}_type.lmn &> $dir/${cnt}.txt
  # echo "Target rule: $line" > $dir/${cnt}.txt
  # echo $line | node js/main.js rule4 demo/${type}_type.lmn | lmntal/slim.sh -t | grep -e '---->' > $dir/${cnt}.txt
  echo $line | node js/main.js rule7 demo/${type}_type.lmn | time lmntal/slim.sh &> $dir/${cnt}.txt
  # echo $line | node js/main.js rule4 demo/${type}_type.lmn | time lmntal/slim.sh &> $dir/${cnt}.txt
done
