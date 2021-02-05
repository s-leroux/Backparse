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

In addition to the `Token` and `Rule` predicates, Backparse also provides the `Opt` predicate (equivalent
to the `?` quantifier in regular expressions) and the `Several` predicate (equivalent to the `*`).

See the test files for exemples of usage.



License
=======

Brought to you under the terms of the GPLv3.0 or later license.

Copyright (c) 2021 Sylvain Leroux

