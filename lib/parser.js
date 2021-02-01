"use strict";

const debug = require("debug")("backparse:parser");

// const END = Symbol("END");
const END = "END";

class Parser {
  constructor(startRule) {
    this._grammar = new Map();

    this._token = null; // The stack of the tokens to process
    this._lastToken = null; // The head of the list of tokens accepted so far

    this._status = undefined;

    this._astHead = null;

    this._root = {
      trace: "root",
      matcher: test(END),
      successPath: null,
      failPath: null,
      savedToken: null,

      astNode: this._astRoot,
    };

    this._fail = {
      trace: "failure",
      matcher: stop("failure"),
      successPath: null,
      failPath: null,
      savedToken: null,

      astNode: this._astRoot,
    };

    this._state = {
      trace: "init -> " + startRule,
      savedToken: null,
      matcher: rule(startRule),
      successPath: this._root,
      failPath: this._fail,

      astNode: this._astRoot,
    };

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
  fail() {
    this._token = this._state.savedToken;
    this._astHead = this._state.astHead;
    this._state = this._state.failPath;
  }

  /*
      Process the next token of the stream.
  */
  accept(tk) {
    debug("Accept:", tk, this._state);

    this.pushToken(tk);

    while(this._token && this._state) {
      this._state.matcher(this);
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
    parser._state = null;
  }

  return _stop;
}

function test(token) {
  function _test(parser) {
    debug("Test:", token, parser._token);

    if (parser._token.value == token) {
      parser._status = "success";
      parser._state = null;
    }
    else {
      parser._status = "failure";
      parser._state = null;
    }
  }

  return _test;
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
      parser.fail();
    }
    else {

      let savedFailPath = parser._state.failPath;
      let savedSuccessPath = parser._state.successPath;
      let savedToken = parser._state.savedToken;
      let parserToken = parser._token;
      let parserAstHead = parser._astHead;

      let failPath = {
        trace: name + " F " + (n+1),
        failPath: savedFailPath,
        successPath: savedSuccessPath,
        matcher: rule(name, n+1),
        savedToken: savedToken,

        astHead: parser._state.astHead,
      };

      let lastSuccessPath = {
        trace: name + " S " + (n+1),
        failPath: failPath,
        successPath: savedSuccessPath,
        matcher(parser) {
          parser._astHead = {
            trace: "R:" + name,
            arity: form.length,
            token: parserToken,
            next: parser._astHead,
          };
          parser._state = savedSuccessPath;
        },
        savedToken: parser._token,
      };

      parser._state = lastSuccessPath; // override parse._state in case of empty form
      let i = form.length; // and start expansion
      while(i--) {
        lastSuccessPath = parser._state = {
          trace: name + "/" + n + "/" + i,
          successPath: lastSuccessPath,
          failPath: failPath,
          matcher: form[i],
          savedToken: parser._token,

          astHead: parser._astHead,
        };
      }
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
        arity: 0,
        token: parser._token,
        next: parser._astHead,
      };
      parser._token = parser._token.next;
      parser._state = parser._state.successPath;
    }
    else {
      parser.fail();
    }
  }

  return _token;
}

module.exports = {
  Parser: Parser,
  rule: rule,
  token: token,
  END: END,
};
