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
    let ast = this.astHead;

    let head;
    console.log("------------------------------------------");
    console.log("    id                   F       S     AST");
    console.log("------------------------------------------");
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
      astHead: null,
    });

    this._fail = new State(null, null, {
      trace: "failure",
      matcher: stop("failure"),
      savedToken: null,
      astHead: null,
    });

    this._state = new State(this._fail, this._root, {
      trace: "init " + startRule,
      matcher: rule(startRule),
      savedToken: null,
      astHead: null,
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
      dumpAst(this._astHead);
      console.log(this._token);
      this._state = this._state.matcher(this);
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

function opt(next) {
  function _opt(parser) {
    // The "Optional" modifier.
    // Bind both the successPath and failPath to
    // the same state.

    return new State(this.successPath, this.successPath, {
      trace: "?",
      matcher: next,
      savedToken: parser._token,
      astHead: parser._astHead,
    });
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
      return parser.fail(this.failPath);
    }
    else {

      let savedFailPath = this.failPath;
      let savedSuccessPath = this.successPath;
      let parserToken = parser._token;
      let savedTrace = this.trace;
      let parserAst = parser._astHead;

      let failPath = new State(this.failPath, this.successPath, {
        trace: name + " F " + (n+1),
        matcher: rule(name, n+1),
        savedToken: this.savedToken,
        astHead: this.astHead,
      });

      let lastSuccessPath = new State(failPath, savedSuccessPath, {
        trace: name + " S " + (n+1),
        matcher(parser) {
          let children = []
          let ast = parser._astHead;
          while(ast != parserAst) {
            children.push({
              value: ast.value,
              children: ast.children ?? [],
              // and... ???
            });

            const astNode = ast;
            ast = ast.next;
            astNode.next = null;
          }
          children.reverse();

          parser._astHead = {
            trace: "R:" + savedTrace,
            token: parserToken,
            next: ast,
            children: children,
            value: name,
          };
          return this.successPath;
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
  function _token(parser) {
    debug("Token", value,"==",parser._token);

    if (parser._token.value === value) {
      parser._astHead = {
        trace: "T:" + value,
        token: parser._token,
        value: parser._token.value,
        next: parser._astHead,
      };
      parser._token = parser._token.next;

      return this.successPath;
    }
    else {
      return parser.fail(this.failPath);
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
