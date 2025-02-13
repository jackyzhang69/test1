// fillerGraph.js

// We can emulate the enum by using a frozen object.
// No logic change - just a direct translation to JS style.
const FGAction = Object.freeze({
  CLICK: 'click',
  EXPECT: 'expect',
  FILL: 'fill',
  FILL_DATE: 'fill_date',
  GET: 'get',
  GOTO: 'goto',
  MATCH_SELECT: 'match_select',
  PAUSE: 'pause',
  QA: 'qa',
  SELECT: 'select',
  UPLOAD: 'upload',
  WAIT: 'wait',
});

class FGTransition {
  constructor(source, target, value) {
    this.source = source;
    this.target = target;
    this.value = value;
  }

  toString() {
    if (this.value) {
      return `(${this.source} --> ${this.value} --> ${this.target})`;
    }
    return `(${this.source} --> ${this.target})`;
  }
}

class FGNode {
  constructor(
    id,
    name = null,
    description = null,
    data = null,
    selector = null,
    option = null,
    action = null,
    isEntrance = false,
    isOptional = false,
    skip = false
  ) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.data = data;
    this.selector = selector;
    this.option = option;
    this.action = action;
    this.is_entrance = isEntrance;
    this.is_optional = isOptional;
    this.skip = skip;
    this.transitions = [];
  }

  add_transition(targetNodeId, value) {
    this.transitions.push(new FGTransition(this.id, targetNodeId, value));
  }

  toString() {
    // For debug or logging; mirrors Python's __repr__
    return `FGNode(id=${this.id}, name=${this.name}, transitions=${this.transitions.map(t => t.toString())})`;
  }
}

const fs = require('fs');

class FillerGraph {
  constructor() {
    this.nodes = {};
    this._id_counter = 0;
    this.current = 0;
  }

  add_node({
    name = null,
    description = null,
    data = null,
    selector = null,
    option = null,
    action = null,
    is_entrance = false,
    is_optional = false,
    skip = false
  } = {}) {
    const node = new FGNode(
      this._id_counter,
      name,
      description,
      data,
      selector,
      option,
      action,
      is_entrance,
      is_optional,
      skip
    );
    this.nodes[node.id] = node;
    this._id_counter += 1;
    return node;
  }

  add_transition(sourceNodeId, targetNodeId, value) {
    if (this.nodes[sourceNodeId] && this.nodes[targetNodeId]) {
      this.nodes[sourceNodeId].transitions.push(
        new FGTransition(sourceNodeId, targetNodeId, value)
      );
    } else {
      throw new Error('Source or target node not found in the graph');
    }
  }

  get_next(value = null) {
    const node = this.nodes[this.current];
    if (!node) return null;

    // last node
    if (node.transitions.length === 0) {
      return null;
    }

    // direct transition
    if (node.transitions.length === 1) {
      this.current = node.transitions[0].target;
      return this.nodes[this.current];
    }

    // transition with value
    let wildcard = null;
    for (const transition of node.transitions) {
      if (transition.value === value) {
        this.current = transition.target;
        return this.nodes[this.current];
      }
      if (transition.value === '*') {
        wildcard = transition.target;
      }
    }
    if (wildcard != null) {
      this.current = wildcard;
      return this.nodes[this.current];
    }
    return null;
  }

  set_current(nodeId) {
    this.current = nodeId;
    return this.nodes[this.current];
  }

  dump_to_json(filename) {
    // Reproduce the original dictionary structure as closely as possible
    const graphDict = {
      nodes: {}
    };
    for (const nodeId of Object.keys(this.nodes)) {
      const node = this.nodes[nodeId];
      graphDict.nodes[node.id] = {
        name: node.name,
        description: node.description,
        data: node.data,
        selector: node.selector,
        option: node.option,
        action: node.action,
        is_entrance: node.is_entrance,
        is_optional: node.is_optional,
        skip: node.skip,
        transitions: node.transitions.map(t => [t.source, t.target, t.value])
      };
    }

    fs.writeFileSync(filename, JSON.stringify(graphDict, null, 4), 'utf-8');
  }

  static restore_from_json(filename, patch = null) {
    const graph = new FillerGraph();
    const rawData = fs.readFileSync(filename, 'utf-8');
    const graphDict = JSON.parse(rawData);
    let { nodes } = graphDict;

    if (patch && patch in graphDict) {
      // Original code says: if patch in graph_dict, nodes.update(graph_dict[patch])
      // We'll do the JS equivalent by merging objects
      const patchObj = graphDict[patch];
      nodes = { ...nodes, ...patchObj };
    }

    for (const nodeId of Object.keys(nodes)) {
      const nodeData = nodes[nodeId];
      const node = new FGNode(
        parseInt(nodeId, 10),
        nodeData.name,
        nodeData.description,
        nodeData.data,
        nodeData.selector,
        nodeData.option,
        nodeData.action,
        nodeData.is_entrance,
        nodeData.is_optional,
        nodeData.skip
      );
      node.transitions = (nodeData.transitions || []).map(
        t => new FGTransition(t[0], t[1], t[2])
      );
      graph.nodes[node.id] = node;
      // Keep track of max ID to maintain correct _id_counter
      if (node.id >= graph._id_counter) {
        graph._id_counter = node.id + 1;
      }
    }
    return graph;
  }

  toString() {
    return Object.values(this.nodes)
      .map(
        node =>
          `${node.id}: ${node.name} (${node.data}): ` +
          node.transitions.map(t => t.toString()).join(', ')
      )
      .join('\n');
  }
}

// Additional helper functions mirrored from your Python code
function _create_graph() {
  const graph = new FillerGraph();
  graph.add_node({ name: 'Start', is_entrance: true });
  graph.add_node({ name: 'End' });
  graph.add_transition(0, 1, 'True');
  return graph;
}

function _restore_graph(file) {
  const graph = FillerGraph.restore_from_json(file);
  return graph;
}

function _increase_id(file, fromId, num = 1) {
  const graph = FillerGraph.restore_from_json(file);
  const idMap = {};

  for (const node of Object.values(graph.nodes)) {
    if (node.id < fromId) {
      continue;
    }
    const newId = node.id + num;
    idMap[node.id] = newId;
    node.id = newId;
  }

  // Update transitions to reflect the new IDs
  for (const node of Object.values(graph.nodes)) {
    for (const transition of node.transitions) {
      if (idMap.hasOwnProperty(transition.source)) {
        transition.source = idMap[transition.source];
      }
      if (idMap.hasOwnProperty(transition.target)) {
        transition.target = idMap[transition.target];
      }
    }
  }
  // Write out modified graph
  const outFile = file.replace('.json', '_mod.json');
  graph.dump_to_json(outFile);
}

// If we want to run this file directly (similar to Python's `if __name__ == "__main__":`)
if (require.main === module) {
  const lmia = _restore_graph('lmia.json');
  _increase_id('lmia.json', 105);
}

// Export what you need if you’re requiring this module elsewhere:
module.exports = {
  FGAction,
  FGNode,
  FGTransition,
  FillerGraph,
  _create_graph,
  _restore_graph,
  _increase_id,
};
