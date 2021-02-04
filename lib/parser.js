"use strict";

const debug = require("debug")("backparse:parser");

// const END = Symbol("END");
const END = "END";
let   g_id = 0;

/*
  A state in the grammar automaton.

  A state has an action() member which is invoked
  when entering the state. It performs all the
  necessary tasks for this state and return the
  automaton's step where processing must continue.
*/
class BaseState {
  constructor(trace) {
    this.id = g_id++;
    this.trace = trace;
  }

  eval(/*parser*/) {
    return null; // abort
  }

  dump() {
    const visited = new Set();
    const queue = [ this ];
    let ast = this.astHead;

    let head;
    console.log("--------------------------------------------------");
    console.log("    id                   F       S       B     AST");
    console.log("---------------------------------------------------");
    //           0123456789012345678901234567890123456789
    while((head = queue.shift())) {
      if (head && !visited.has(head)) {
        visited.add(head);
        queue.push(head.successPath);
        queue.push(head.failPath);

        const parts = [
          (head.id ?? "").toString().padStart(6),
          (head.trace ?? "").padEnd(10),
          (head.failPath?.id ?? "").toString().padStart(6),
          (head.successPath?.id ?? "").toString().padStart(6),
          (head.nextState?.id ?? "").toString().padStart(6),
          (head.astHead?.trace ?? "").toString().padStart(6),
        ];
        console.log(parts.join("  "), head.savedToken);

        ast = head.astHead?.next;
        while(ast) {
          console.log((ast.trace ?? "").padStart(42));
          ast = ast.next;
        }

      }
    }
  }
}

class SimpleState extends BaseState {
  constructor(trace, nextState, action) {
    super(trace);
    this.action = action;
    this.nextState = nextState;
  }

  eval(parser) {
    this.action(parser);

    return this.nextState;
  }
}

/*
  A state that restores the parser's state to the value it
  had when this state was created.
*/
class Reset extends SimpleState {
  constructor(nextState, parser) {
    super("reset", nextState, (parser) => {
      parser._astHead = this.savedAst;
      parser._token = this.savedToken;

      return this.nextState;
    });

    this.nextState = nextState;
    this.savedAst = parser._astHead;
    this.savedToken = parser._token;
  }
}

/*
  A state with two possible outcome: success or failure.
*/
class AltState extends BaseState {
  constructor(trace, failPath, successPath, action) {
    super(trace);
    this.failPath = failPath;
    this.successPath = successPath;
    this.action = action;
  }

  eval(parser) {
    return this.action(parser);
  }

}

class Grammar {
  constructor() {
    this._grammar = new Map();
  }

  /*
      Define a new rule.

      If a rule with the same name already exists in the
      grammar, it is replaced.
  */
  define(name, ...forms) {
    this._grammar.set(name, {
      name: name,
      forms: forms,
    });
  }

  get(rule) {
    return this._grammar.get(rule);
  }

  parser(startRule) {
    return new Parser(this, startRule);
  }
}

class Parser {
  constructor(grammar, startRule) {
    this._grammar = grammar;

    this._token = null; // The stack of the tokens to process
    this._lastToken = null; // The head of the list of tokens accepted so far

    this._status = undefined;

    this._astHead = null;

    this._root = new SimpleState("init", null, test(END));
    this._fail = new SimpleState("failure", null, stop("failure"));

    this._state = new AltState(startRule, this._fail, this._root, rule(startRule));

  }


  /*
      Push a new token
  */
  pushToken(tk) {
    const newToken = {
      next: null,
      value: tk,
    };

    if (this._lastToken)
      this._lastToken.next = newToken;
    this._lastToken = newToken;

    if (!this._token) // not strictly required but makes code more resilient to abuses
      this._token = newToken;
  }

  popToken() {
    let result = this._token;

    if (result) {
      this._token = result.next;
    }

    return result;
  }

  /*
    Pack the nodes up to ''limit'' (excl.) into
    a newly created node to produce a tree-like
    structure.
  */
  packInto(name, limit) {
    let children = [];
    let ast = this._astHead;
    while(ast != limit) {
      children.push({
        value: ast.value,
        children: ast.children ?? [],
        // and... ???
      });

      ast = ast.next;
    }
    children.reverse();

    this._astHead = {
      trace: "R",
      next: ast,
      value: name,
      children: children,
    };
  }

  /*
    Abandon the current state and restore
    the context to its previous condition.
  */
  fail(failPath) { // XXX refactor this. Maybe member of State ?
    console.log("Fail");
    console.log(this._token);
    console.log(this._state.savedToken);
    console.log(this._state?.id);
    this._token = this._state.savedToken;
    this._astHead = this._state.astHead;
    return failPath;
  }

  /*
      Process the next token of the stream.
  */
  accept(tk) {
    debug("Accept:", tk, this._state);

    this.pushToken(tk);

    while(this._token && this._state) {
      this._state.dump();
      dumpAst(this._astHead);
      console.log(this._token);
      this._state = this._state.eval(this);
    }
  }

  ast() {
    return this._astHead && {
      children: this._astHead.children,
      value: this._astHead.value,
    };
  }

  log() {
    debug("_token", this._token);
    for(let sp = this._state; sp; sp = sp.successPath) {
      console.log(sp.savedToken?.value?.toString() || " ", sp.trace);

    }
  }
}

function dumpAst(ast) {
  console.log("------------------------------");
  console.log("    ast                       ");
  console.log("------------------------------");
  //           0123456789012345678901234567890123456789
  for(let head = ast; head; head = head.next) {
    const parts = [
      (head.trace ?? "").toString().padEnd(22),
      (head.children ?? []).map(n => n.value).join(", "),
    ];
    console.log(parts.join("  "));
  }
  console.log("------------------------------");
}

function print(head) {
  for(let node = head; node; node = node.next) {
    process.stdout.write(node.trace || "");
    process.stdout.write(":");
    process.stdout.write(node.token?.value || "");
    process.stdout.write(" -> ");
  }
  process.stdout.write("\n");
}

function stop(status) {
  function _stop(parser) {
    parser._status = status;

    return null;
  }

  return _stop;
}

function test(token) {
  function _test(parser) {
    debug("Test:", token, parser._token);

    if (parser._token.value == token) {
      parser._status = "success";
    }
    else {
      parser._status = "failure";
    }

    return null;
  }

  return _test;
}

function several(next) {
  function __several(parser) {
    // The "Zero-to-many" modifier.
    // Recursively bind the successPath to another ``several'' modifier

    const newSuccess = new AltState("again", this.successPath, this.successPath, __several);
    const newFail = new Reset(this.failPath, parser);

    return new AltState("iter", newFail, newSuccess, next);
  }
  function _several(parser) {
    const parserAst = parser._astHead;

    // Pack the result into an AST node
    const newSuccess = new AltState(
      "pack",
      this.successPath,
      this.successPath,
      function(parser) {
        parser.packInto("*", parserAst);
        return this.successPath;
      }
    );

    return new AltState("first", newSuccess, newSuccess, __several);
  }

  return _several;
}

function opt(next) {
  function _opt(parser) {
    // The "Zero-to-one" modifier.
    // Bind both the successPath and failPath to
    // the same state.
    const revert = new Reset(this.successPath, parser);
    return new AltState("opt", revert, this.successPath, next);
  }

  return _opt;
}

function rule(name, n=0) {
  function _rule(parser) {
    // expand the rule. Synthetize a new failure path.
    let production = parser._grammar.get(name);

    debug(name, n, production);

    // XXX Handle error here

    let form = production.forms[n];
    if (form === undefined) {
      // no more form to explore. Follow that fail path
      // and restore the token
      return this.failPath;
    }
    else {

      let savedSuccessPath = this.successPath;
      let parserAst = parser._astHead;

      let failPath = new AltState(
        `try ${name}/${n+1}`,
        this.failPath, 
        this.successPath, 
        rule(name, n+1)
      );
      failPath = new Reset(failPath, parser);

      let lastSuccessPath = new SimpleState("pack", savedSuccessPath, function(parser) {
        parser.packInto(name, parserAst);
      });

      let i = form.length; // and start expansion
      while(i--) {
        lastSuccessPath = new AltState(
          `${name}/${n}/${i}`,
          failPath,
          lastSuccessPath,
          form[i]
        );
      }

      return lastSuccessPath;
    }
    // console.log(parser._state);
  }

  return _rule;
}

function token(value) {
  function _token(parser) {
    debug("Token", value,"==",parser._token);

    if (parser._token.value === value) {
      parser._astHead = {
        trace: "T:" + value,
        value: parser._token.value,
        next: parser._astHead,
      };
      parser._token = parser._token.next;

      return this.successPath;
    }
    else {
      return this.failPath;
    }
  }

  return _token;
}

module.exports = {
  Parser: Parser,
  Grammar: Grammar,
  rule: rule,
  token: token,
  opt: opt,
  several: several,
  END: END,
};
