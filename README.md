Backparse
=========

[![Build Status](https://travis-ci.org/s-leroux/Backparse.png?branch=master)](https://travis-ci.org/s-leroux/Backparse)

A backtracking parser for node. While not very efficient, it should parse almost any
grammar you can throw at it.

Usage
=====

You need three things in order to use _backparse_:

1. First, you need to define a grammar;
2. Then you need to define the actions to execute when each rule is encountered;
3. Finally, you need to provide the stream of tokens corresponding to the sentence you have to parse.

Backparse will help you for the (1) and (2) steps. But for the step (3), you are on your own.
Backparse does not provide any facility to tokenize your input.

Defining your grammar
=====================

To define a grammar, you'll instanciate a `Grammar` object:

```
const { Grammar } = require("backparse");

const grammar = new Grammar();
```

You then define the set of rules your grammar will reconize using the `Grammar.define()` method:

```
  // define the rule "r" to be either the sequence of tokens "A" and "B",
  // or the token "A", followed by "r", followed by "B".
  //
  // In practice, the rule will match any sequence of "A" tokens followed by the
  // same number of "B" tokens:
  grammar.define("r",
    [ Token("A"), Token("B") ],
    [ Token("A"), Rule("r"), Token("B") ]
  );
```

The example above defines a grammar containing only one rule. Notice the self-reference
on the second alternative. This is how you define a recursive rule.

A grammar may contain an arbitrary number of rules. Self-recursivity and mutual recursivity are
supported as long a it's not a left-recursion. In that case, Backparse would enter in an infinite
loop.

In addition to the `Token` and `Rule` predicates, Backparse also provides several quantifiers:
`ZeroOrOne`, `ZeroOrMore` and `OneOrMore`.

See the test files for examples of usage.

Reducer
=======

The grammar defines the syntactic rules or the language to parse. The _reducer_ de
efines its semantic. Each time the parser reduce a rule, it will invoke the corresponding
reducer passing the children as paramaters.

This processus occurs from the bottom (the leafs of the syntax tree) to the top 
(the root node of your grammar).

There is no garantee the builder will be called only once per node. In fact, due to backtracking,
there are chances the builder will be called _many times_ on the same node. As a rule
of thumb, the builder shouldn't have any side effect.


You give the reducer as the last parameter in a rule definition:

```
  grammar.define("r",
    [ Rule("int"), Token("+"), Rule("int") ],
    function(fail, a, op, b) {
      return a+b;
    }
  );
```


In the `test/examples` folder, you will find a calculator which uses the builder to compute
the intermediate results on the fly during parsing. On the other hand, you may prefer building
an Abstract Syntax Tree to further manipulate it before generating code. The choice is up
to you [XXX Missing AST example].

Please notice the `fail` parameter on the reducer signature. This is a special value you 
have to return to force backtracking. If you do not provide a reducer, the default behavior
will be to pack the children in an array.

Token
=====

Backparse do not provide any facility to parse your input. Actually, it makes no assumption at
all about what this input is. All the library sees is a stream of token. You provides the
token (in order) by calling one or several time the `accept` method. 

You must provide the special `END` token as the last token.

```
  parser.accpt("A", "B", "C", END);
```

License
=======

Brought to you under the terms of the GPLv3.0 or later license.

Copyright (c) 2021 Sylvain Leroux

