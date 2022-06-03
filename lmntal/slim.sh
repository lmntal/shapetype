#!/bin/bash

source $(dirname $0)/env.sh

# $lmntal --slimcode --hl-opt $@

if [ -p /dev/stdin ]; then
  # stdin comes from pipe
  cat - | $lmntal --slimcode --hl-opt --stdin-lmn | $slim --use-builtin-rule --hl $@ -
else
  $slim --use-builtin-rule --hl $@
fi
