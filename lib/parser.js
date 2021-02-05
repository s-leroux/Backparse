"use strict";

const debug = require("debug")("backparse:parser");

const { DefaultPacker } = require("./packer");

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

    console.log("--------------------------------------------------");
    console.log("    id                   F       S       B     AST");
    console.log("--------------------------------------------------");
    //           012345678901234567890123456789012345678901234567890123456789
    while(queue.length) {
      let head = queue.shift();
      if (head && !visited.has(head)) {
        visited.add(head);
        queue.push(head.successPath);
        queue.push(head.failPath);
        queue.push(head.nextState);

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

class IState extends BaseState {
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

class FState extends BaseState {
  constructor(trace, action) {
    super(trace);
    this.action = action;
  }

  eval(parser) {
    return this.action(parser);
  }
}

/*
  A state that restores the parser's state to the value it
  had when this state was created.
*/
class Reset extends IState {
  constructor(nextState, parser) {
    super("reset", nextState, (parser) => {
      parser._astHead = this.savedAst;
      parser._tokenHead = this.savedToken;
    });

    this.savedAst = parser._astHead;
    this.savedToken = parser._tokenHead;
  }
}

/*
  A state with two possible outcome: success or failure.
*/
class YState extends BaseState {
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

class Parser {
  constructor(grammar, startRule, packer=undefined) {
    this._grammar = grammar;
    this._packer = packer ?? new DefaultPacker;

    this._tokenHead = null; // The stack of the tokens to process
    this._lastToken = null; // The head of the list of tokens accepted so far

    this._status = undefined;

    this._astHead = null;

    this._root = new FState("init", test(END));
    this._fail = new FState("failure", stop("failure"));

    this._state = new YState(startRule, this._fail, this._root, Rule(startRule));

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

    if (!this._tokenHead) // not strictly required but makes code more resilient to abuses
      this._tokenHead = newToken;
  }

  popToken() {
    let result = this._tokenHead;

    if (result) {
      this._tokenHead = result.next;
    }

    return result?.value;
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
      children.push(ast.value);

      ast = ast.next;
    }
    children.reverse();

    const value = this._packer.rule(name, ...children);
    if (value === undefined) {
      return false;
    }

    this._astHead = {
      trace: "R",
      next: ast,
      value: value,
    };

    return true;
  }

  packToken(tk) {
    const value = this._packer.token(tk);
    if (value === undefined) {
      return false;
    }

    this._astHead = {
      trace: "T:" + value,
      next: this._astHead,
      value: value,
    };

    return true;
  }

  /*
    Abandon the current state and restore
    the context to its previous condition.
  */
  fail(failPath) { // XXX refactor this. Maybe member of State ?
    // console.log("Fail");
    // console.log(this._tokenHead);
    // console.log(this._state.savedToken);
    // console.log(this._state?.id);
    this._tokenHead = this._state.savedToken;
    this._astHead = this._state.astHead;
    return failPath;
  }

  /*
      Process the next token of the stream.
  */
  accept(...tokens) {
    debug("Accept:", tokens, this._state);

    for(let token of tokens) {
      this.pushToken(token);
    }

    while(this._tokenHead && this._state) {
      // this._state.dump();
      // dumpAst(this._astHead);
      // console.log(this._tokenHead);
      this._state = this._state.eval(this);
    }
  }

  ast() {
    return this._astHead?.value;
  }

  log() {
    debug("_tokenHead", this._tokenHead);
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
      (head.value ?? "").toString(),
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
    debug("Test:", token, parser._tokenHead);

    if (parser._tokenHead.value == token) {
      parser._status = "success";
    }
    else {
      parser._status = "failure";
    }

    return null;
  }

  return _test;
}

function Several(next) {
  function __several(parser) {
    // The "Zero-to-many" modifier.
    // Recursively bind the successPath to another ``several'' modifier

    const newSuccess = new YState("again", this.successPath, this.successPath, __several);
    const newFail = new Reset(this.failPath, parser);

    return new YState("iter", newFail, newSuccess, next);
  }
  function _several(parser) {
    const parserAst = parser._astHead;

    // Pack the result into an AST node
    const newSuccess = new YState(
      "pack",
      this.failPath,
      this.successPath,
      function(parser) {
        if (parser.packInto("*", parserAst))
          return this.successPath;
        else
          return this.failPath;
      }
    );

    return new YState("first", newSuccess, newSuccess, __several);
  }

  return _several;
}

function Opt(next) {
  function _opt(parser) {
    // The "Zero-to-one" modifier.
    // Bind both the successPath and failPath to
    // the same state.
    const revert = new Reset(this.successPath, parser);
    return new YState("opt", revert, this.successPath, next);
  }

  return _opt;
}

function Rule(name, n=0) {
  function _rule(parser) {
    // expand the rule. Synthetize a new failure path.
    let production = parser._grammar.get(name);

    debug(name, n, production);

    // XXX Handle error here
    if (production === undefined)
      debugger;

    let form = production.forms[n];
    if (form === undefined) {
      // no more form to explore. Follow that fail path
      // and restore the token
      return this.failPath;
    }
    else {

      let savedSuccessPath = this.successPath;
      let parserAst = parser._astHead;

      let failPath = new YState(
        `try ${name}/${n+1}`,
        this.failPath, 
        this.successPath, 
        Rule(name, n+1)
      );
      failPath = new Reset(failPath, parser);

      let lastSuccessPath = new YState(
        "pack",
        failPath,
        savedSuccessPath,
        function(parser) {
          if (parser.packInto(name, parserAst))
            return this.successPath;
          else
            return this.failPath;
        }
      );

      let i = form.length; // and start expansion
      while(i--) {
        lastSuccessPath = new YState(
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

function Token(value) {
  function _token(parser) {
    debug("Token", value,"==",parser._tokenHead);

    if (parser._packer.match(parser._tokenHead.value, value)) {
      if (parser.packToken(parser._tokenHead.value)) {
        parser._tokenHead = parser._tokenHead.next;
        return this.successPath;
      }
    }
    // otherwise
    return this.failPath;
  }

  return _token;
}

module.exports = {
  Parser: Parser,
  Rule: Rule,
  Token: Token,
  Opt: Opt,
  Several: Several,
  END: END,
};
