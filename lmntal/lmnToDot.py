#!/usr/bin/env python3
# author: Ayami Hashimoto

import sys
import re

def parseSS(str):
    return re.search("[0-9]+", re.search("ss\([0-9]+,", str).group(0)).group(0)

def parseTransition(str):
    transitions = []
    transition_group = re.findall("\[[0-9]+\|[0-9]+\]", str)
    for transition in transition_group:
        ts = re.findall("[0-9]+", transition)
        transitions.append([ts[0], ts[1]])
    return transitions

def parseState(str):
    states = {}
    state_group = re.findall("state\([0-9]+,\{.*?\}\)", str)
    for state in state_group:
        id = re.search("[0-9]+", state).group(0)
        name = re.search("\{.*?\}", state).group(0)
        linelen = 0
        newname = name
        for i in range(0, len(name)):
            if name[i] == ' ' and linelen > 15:
                newname = newname[:i] + "\n"+ newname[i+1:]
                linelen = 0
            else:
                linelen += 1
        states[id] = newname
    return states

def findFinalStateID(states, transitions):
    notFinals = set()
    for transition in transitions:
        notFinals.add(transition[0])
    return states.keys() - notFinals

def getStateColors(states, transitions):
    colorlist = ["#84b9cb", "#59b9c6", "#38b48b", "#69b076", "#b0ca71", "#dccb18", "#f8b500"]
    framelist = ["#007bbb", "#008899", "#006e54", "#007b43", "#7b8d42", "#928c36", "#f08300"]
    stateTmps = dict.fromkeys(states, 0)
    stateColors = dict.fromkeys(states, ["", ""])
    for transition in transitions:
        stateTmps[transition[0]] -= 1
        stateTmps[transition[1]] += 1
    for state in stateTmps:
        if stateTmps[state] >= 3:
            stateColors[state] = [colorlist[6], framelist[6]]
        elif stateTmps[state] <= -3:
            stateColors[state] = [colorlist[0], framelist[0]]
        else:
            stateColors[state] = [colorlist[stateTmps[state]+3], framelist[stateTmps[state]+3]]
    return stateColors

def toDot(str):
    ss_id = parseSS(str)
    transitions = parseTransition(str)
    states = parseState(str)
    final_ids = findFinalStateID(states, transitions)
    stateColors = getStateColors(states, transitions)
    print("digraph states {")
    print('node [style = "solid, filled", penwidth = "3"];')
    for transition in transitions:
        print('"', states[transition[0]], '"', "->", '"', states[transition[1]], '"', ";")
    for state_id in stateColors:
        print('"', states[state_id], '"', '[color = "', stateColors[state_id][1], '", fillcolor = "', stateColors[state_id][0], '"];')
    print('"', states[ss_id], '"', '[shape = doubleoctagon, color = "#3e62ad", fillcolor = "#bbbcde"];')
    for final_id in final_ids:
        print('"', states[final_id], '"', '[shape = doubleoctagon, color = "#e83929", fillcolor = "#f5b1aa"];')

    print("}")

if __name__ == "__main__":
    str = ""
    if len(sys.argv) == 1:
        str = input()
    elif len(sys.argv) == 2:
        with open(sys.argv[1]) as f:
            str = f.read()
    else:
        print('Usage: "python3 lmnToDot.py [filename]"')
        sys.exit()
    toDot(str)
