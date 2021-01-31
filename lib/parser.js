const END = Symbol("END");

class Parser {
  constructor(startRule) {
    this._grammar = new Map();

    this._token = null; // The stack of the tokens to process
    this._lastToken = null;

    this._status = undefined;

    this._root = {
      trace: "root",
      matcher: test(END),
      successPath: null,
      failPath: null,
      savedToken: null,
    };

    this._fail = {
      trace: "failure",
      matcher: stop("failure"),
      successPath: null,
      failPath: null,
      savedToken: null,
    };

    this._state = {
      trace: "init -> " + startRule,
      savedToken: null,
      matcher: rule(startRule),
      successPath: this._root,
      failPath: this._fail,
    };

  };


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
      Process the next token of the stream.
  */
  accept(tk) {
    console.log("Accept:", tk, this._state);
    this.pushToken(tk);
    this._lastToken = this._token;

    while(this._token && this._state) {
      this.log();
      this._state.matcher(this);
    }
  }

  log() {
    console.log("_token", this._token);
    for(let sp = this._state; sp; sp = sp.successPath) {
      console.log(sp.savedToken?.value || " ", sp.trace);
    }
  }
};

function stop(status) {
  function _stop(parser) {
    parser._status = status;
    parser._state = null
  }

  return _stop;
}

function test(token) {
  function _test(parser) {
    console.log("Test:", token, parser._token);

    if (parser._token.value == token) {
      parser._status = "success";
      parser._state = null
    }
    else {
      parser._status = "failure";
      parser._state = null
    }
  }

  return _test;
}

function success() {
  function _success(parser) {
    console.log("Success");

    parser._state = parser._state.successPath;
  }

  return _success;
}

function rule(name, n=0) {
  function _rule(parser) {
    // expand the rule. Synthetize a new failure path.
    let production = parser._grammar.get(name);

    console.log(name, n, production);

    // XXX Handle error here
    
    let form = production.forms[n];
    if (form === undefined) {
      // no more form to explore. Follow that fail path
      // and restore the token
      parser._token = parser._state.savedToken;
      parser._state = parser._state.failPath;
    }
    else {
      let savedFailPath = parser._state.failPath;
      let savedSuccessPath = parser._state.successPath;
      let lastSuccessPath = savedSuccessPath;
      let savedToken = parser._state.savedToken;

      let i = form.length; // and start expansion
      while(i--) {
        lastSuccessPath = parser._state = {
          trace: name + "/" + n + "/" + i,
          successPath: lastSuccessPath,
          failPath: {
            trace: name + "/" + (n+1),
            failPath: savedFailPath,
            successPath: savedSuccessPath,
            matcher: rule(name, n+1),
            savedToken: savedToken,
          },
          matcher: form[i],
          savedToken: parser._token,
        };
      }
    }
    // console.log(parser._state);
  }

  return _rule;
}

function token(value) {
  function _token(parser) {
    console.log("Token", value,"==",parser._token);

    if (parser._token.value === value) {
      parser._token = parser._token.next;
      parser._state = parser._state.successPath;
    }
    else {
      parser._token = parser._state.savedToken;
      parser._state = parser._state.failPath;
    }
  }

  return _token;
}

module.exports = {
  Parser: Parser,
  rule: rule,
  token: token,
  success: success,
  END: END,
};
