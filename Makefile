.PHONY: all graph rule
ALLSRC := $(wildcard src/*.ts)

all: js/main.js

test: js/main.js
	node js/main.js test

js/main.js: $(ALLSRC) tsconfig.json Makefile
	npx tsc
