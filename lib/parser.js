"use strict";

const debug = require("debug")("backparse:parser");

// const END = Symbol("END");
const END = "END";
let   g_id = 0;
const noop = function() {};

class State {
  constructor(failPath, successPath, opt) {
    this.id = g_id++;
    this.trace = opt.trace ?? "S" + this.id;
    this.failPath = failPath;
    this.successPath = successPath;
    this.matcher = opt.matcher ?? noop;
    this.savedToken = opt?.savedToken ?? successPath?.savedtoken;
    this.astHead = opt?.astHead ?? successPath?.astHead;
  }

  dump() {
    const visited = new Set();
    const queue = [ this ];

    let head;
    console.log("----------------------------------");
    console.log("    id                   F       S");
    console.log("----------------------------------");
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
        ];
        console.log(parts.join("  "), head.savedToken);
      }
    }
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

    this._root = new State(null, null, {
      trace: "end",
      matcher: test(END),
      savedToken: null,
      astNode: null,
    });

    this._fail = new State(null, null, {
      trace: "failure",
      matcher: stop("failure"),
      savedToken: null,
      astNode: null,
    });

    this._state = new State(this._fail, this._root, {
      trace: "init " + startRule,
      matcher: rule(startRule),
      savedToken: null,
      astNode: null,
    });

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
      console.log(this._token);
      this._state = this._state.matcher(
                        this,
                        this._state.failPath,
                        this._state.successPath);
    }
  }

  ast() {
    let stack = [];

    // first reverse the ast nodes list
    let nodes = [];
    for(let head = this._astHead; head; head = head.next) {
      nodes.push(head);
    }

    // now, process the nodes in order
    let head;
    while((head = nodes.pop())) {
      let args = stack.splice(-head.arity, head.arity);
      while(args.length < head.arity) {
        args.push(undefined);
      }

      stack.push({
        trace: head.trace,
        children : args,
      });
    }

    return stack.pop();
  }

  log() {
    debug("_token", this._token);
    for(let sp = this._state; sp; sp = sp.successPath) {
      console.log(sp.savedToken?.value?.toString() || " ", sp.trace);

    }
  }
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

function opt(next) {
  function _opt(parser, failPath, successPath) {
    // The "Optional" modifier.
    // Bind both the successPath and failPath to
    // the same state.

    return new State(parser._state.successPath, parser._state.successPath, {
      trace: "?",
      matcher: next,
      savedToken: parser._token,
      astHead: parser._astHead,
    });
  }

  return _opt;
}

function rule(name, n=0) {
  function _rule(parser, failPath, successPath) {
    // expand the rule. Synthetize a new failure path.
    let production = parser._grammar.get(name);

    debug(name, n, production);

    // XXX Handle error here
    
    let form = production.forms[n];
    if (form === undefined) {
      // no more form to explore. Follow that fail path
      // and restore the token
      return parser.fail(failPath);
    }
    else {

      let savedFailPath = failPath;
      let savedSuccessPath = successPath;
      let parserToken = parser._token;

      failPath = new State(savedFailPath, savedSuccessPath, {
        trace: name + " F " + (n+1),
        matcher: rule(name, n+1),
        savedToken: this.savedToken,
        astHead: this.astHead,
      });

      let lastSuccessPath = new State(failPath, savedSuccessPath, {
        trace: name + " S " + (n+1),
        matcher(parser, fp, sp) {
          parser._astHead = {
            trace: "R:" + name,
            arity: form.length,
            token: parserToken,
            next: parser._astHead,
          };
          return sp;
        },
        savedToken: parser._token,
      });

      let i = form.length; // and start expansion
      while(i--) {
        lastSuccessPath = new State(failPath, lastSuccessPath, {
          trace: name + "/" + n + "/" + i,
          matcher: form[i],
          savedToken: parser._token,

          astHead: parser._astHead,
        });
      }

      return lastSuccessPath;
    }
    // console.log(parser._state);
  }

  return _rule;
}

function token(value) {
  function _token(parser, failPath, successPath) {
    debug("Token", value,"==",parser._token);

    if (parser._token.value === value) {
      parser._astHead = {
        trace: "T:" + value,
        arity: 0,
        token: parser._token,
        next: parser._astHead,
      };
      parser._token = parser._token.next;

      return successPath;
    }
    else {
      return parser.fail(failPath);
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
  END: END,
};
