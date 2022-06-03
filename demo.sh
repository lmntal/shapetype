#!/bin/bash

cd `dirname $0`

make all > /dev/null

if [ $# -ne 2 ]; then
  echo "Error: # of args must be 2." 1>&2
  echo "Usage: ./demo.sh <mode> <name of testcase>" 1>&2
  exit 1
fi

mode=$1
target=$2

case $1 in
  graph* ) suffix=graph;;
  rule* ) suffix=rule;;
  * ) suffix=$1;;
esac

node js/main.js $mode demo/${target}_type.lmn demo/${target}_${suffix}.lmn
