"use strict";

const debug = require("debug")("backparse:parser");

const { defaultBuilder } = require("./builder");

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
  constructor(grammar, startRule, builder=undefined) {
    this._grammar = grammar;
    this._builder = builder ?? defaultBuilder;

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
  pushToken(value) {
    const newToken = {
      next: null,
      value: value,
    };

    if (this._lastToken)
      this._lastToken.next = newToken;
    this._lastToken = newToken;

    if (!this._tokenHead) // not strictly required but makes code more resilient to abuses
      this._tokenHead = newToken;
  }

  /*
    Pack the nodes up to ''limit'' (excl.) into
    an array.
  */
  packIntoArray(limit) {
    let children = [];
    let ast = this._astHead;
    while(ast != limit) {
      children.push(ast.value);

      ast = ast.next;
    }
    children.reverse();

    this._astHead = {
      trace: "R",
      next: ast,
      value: children,
    };

    return true;
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

    const value = this._builder(name, ...children);
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
    const value = tk;
    // const value = this._builder.token(tk);
    // if (value === undefined) {
    //   return false;
    // }

    this._astHead = {
      trace: "T",
      next: this._astHead,
      value: value,
    };

    return true;
  }

  packConstant(value) {
    this._astHead = {
      trace: "C",
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

// ========================================================================
// Quantifiers
// ========================================================================
function ZeroOrMore(next) {
  function __zom(parser) {
    // The "Zero-to-many" modifier.
    // Recursively bind the successPath to another ``several'' modifier

    const newSuccess = new YState("again", this.successPath, this.successPath, __zom);
    const newFail = new Reset(this.failPath, parser);

    return new YState("iter", newFail, newSuccess, next);
  }
  function _zom(parser) {
    const parserAst = parser._astHead;

    // Pack the result into an AST node
    const newSuccess = new YState(
      "pack",
      this.failPath,
      this.successPath,
      function(parser) {
        if (parser.packIntoArray(parserAst))
          return this.successPath;
        else
          return this.failPath;
      }
    );

    return new YState("first", newSuccess, newSuccess, __zom);
  }

  return _zom;
}

function OneOrMore(next) {
  function __oom(parser) {
    // The "Zero-to-many" modifier.
    // Recursively bind the successPath to another ``several'' modifier

    const newSuccess = new YState("again", this.successPath, this.successPath, __oom);
    const newFail = new Reset(this.failPath, parser);

    return new YState("iter", newFail, newSuccess, next);
  }
  function _oom(parser) {
    const parserAst = parser._astHead;

    // Pack the result into an AST node
    const newSuccess = new YState(
      "pack",
      this.failPath,
      this.successPath,
      function(parser) {
        if (parser.packIntoArray(parserAst))
          return this.successPath;
        else
          return this.failPath;
      }
    );

    return new YState("first", this.failPath, newSuccess, __oom);
  }

  return _oom;
}

function ZeroOrOne(next) {
  function _zom(parser) {
    // The "Zero-to-one" modifier.
    // Bind both the successPath and failPath to
    // the same state.
    let fp = new IState("empty", this.successPath, (parser) => {
      parser.packConstant(undefined);
    });
    fp = new Reset(fp, parser);
    return new YState("opt", fp, this.successPath, next);
  }

  return _zom;
}



// ========================================================================
// Predicates
// ========================================================================
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

/*
  A _lexeme_ is a fragment of input data that can be treated
  as a lexical unit. Several different input data can match
  the same lexeme. Think, for example, to an indentifier
  in a source program.

  Backparse makes no assumption regarding the representation
  of a lexeme. The Lexeme() function takes a lambda as an argument.
*/
function Lexeme(accept) {
  function _lexeme(parser) {
    const sentinel = {};
    const v = accept(parser._tokenHead.value, sentinel);

    if (v !== sentinel) {
      if (parser.packToken(v)) {
        parser._tokenHead = parser._tokenHead.next;
        return this.successPath;
      }
    }
    // otherwise
    return this.failPath;
  }

  return _lexeme;
}

/*
  A _token_ is the most basic kind of lexeme since
  its value matches its name. Thinks for exemple of the
  mathematical operators, or eventually to the keywords of
  a programming language.
*/
function Token(tk) {
  return Lexeme((value, fail) => ((tk == value) ? tk : fail));
}

module.exports = {
  Parser: Parser,
  Rule: Rule,
  Lexeme: Lexeme,
  Token: Token,
  ZeroOrOne: ZeroOrOne,
  ZeroOrMore: ZeroOrMore,
  OneOrMore: OneOrMore,
  END: END,
};
