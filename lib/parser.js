"use strict";

const util = require("util");

const END = "END";

class Parser {
  constructor(grammar, start, builder) {
    this.grammar = grammar;
    this.builder = builder;

    this.btstack = []; // backtracking btstack
    this.tokens = []; // all the tokens we know something about

    // Registers
    this.cc = 0; // clock count register
    this.pc = 0; // the program counter

    this.btx = 0; // index of the backtracking btstack's first free cell
    this.fp = null;    // pointer to the current stack frame
    this.sp = this.fp; // top of the data stack

    this.tx = 0; // index of the token we currently process

    this.running = true; // is the machine running?
    this.debugging = !!process.env["BACKPARSE_DBG"]; // is the machine in debugging mode?
    this.status = "ok";

    // Machine initial state
    // bootstrap code segment
    this.code = [
      "reject", undefined,
      "jsr", start,
      "test", (tk, fail) => (tk === END) ? tk : fail,
      "stop", undefined,
    ];
    this.failpoint(0);
    this.pc = 2;
  }

  // ----------------------------------------------------------------------
  // Low-level functions
  // ----------------------------------------------------------------------

  // ----------------------------------------------------------------------
  // Assembler
  // ----------------------------------------------------------------------

  /*
    Unconditional relative jump
  */
  jump(offset) {
    this.pc += offset;
  }

  frame() {
    this.fp = this.sp = {
      fp: this.fp,
      sp: this.sp,
    };
  }

  pack(fct) {
    const frame = this.fp;

    // unwind the stack and pack data
    let data = [];
    for(let p = this.sp; p != this.fp; p = p.sp) {
      data.push(p.data);
    }
    data.reverse();
    if (fct) {
      const sentinel = {};
      data = fct.call(this.context, sentinel, ...data);
      if (data === sentinel) {
        this.fail();
        return;
      }
    }

    // restore the context
    this.fp = frame.fp;
    this.sp = frame.sp;

    this.pushd(data);

  }

  /*
    Unconditional jump to sub-routine (sub-rule?)
  */
  jsr(name) {
    const code = this.grammar.get(name);
    if (code === undefined) {
      throw new TypeError(`rule not found: ${name}`);
    }

    this.sp = {
      fn: name,
      code: this.code,
      pc: this.pc,
      sp: this.sp,
    };

    this.code = code;
    this.pc = 0;
  }

  /*
    Return.
  */
  ret() {
    const result = this.sp;
    const frame = result.sp;

    // restore the context
    this.code = frame.code;
    this.pc = frame.pc;
    this.sp = frame.sp;

    this.pushd(result.data);
  }

  /*
    Save the parser's state to resume processing after a failure.
  */
  failpoint(offset) {
    this.btstack[this.btx++] = {
      code: this.code,
      pc: this.pc + offset,
      fp: this.fp,
      sp: this.sp,
      tx: this.tx,
    };
  }

  /*
    Instruct the parser to resume execution at the last saved failpoint.
  */
  fail() {
    const frame = this.btstack[--this.btx];

    this.code = frame.code;
    this.pc = frame.pc;
    this.fp = frame.fp;
    this.sp = frame.sp;
    this.tx = frame.tx;
  }

  /*
    stop the machine
  */
  stop() {
    this.running = false;
  }

  /*
    stop the machine and signal a failure
  */
  reject() {
    this.stop();
    this.status = "failure";
  }

  /*
    Run a test function against the current token. Branch to the last
    saved failpoint in case of failure, consume the token in case of
    success.
  */
  test(fct) {
    const sentinel = {};
    const token = this.tokens[this.tx++];
    const result = fct(token, sentinel);
    if (result === sentinel) {
      this.fail();
    }
    else {
      this.pushd(result);
    }
  }

  /*
    Push data onto the stack.
  */
  pushd(data) {
    this.sp = {
      data: data,
      sp: this.sp,
    };
  }

  /*
    Excecute one cycle of the evaluation loop
  */
  step() {
    ++this.cc;
    if (this.debugging) {
      this.dump();
    }

    const opcode = this.code[this.pc++];
    const operand = this.code[this.pc++];

    this[opcode](operand);
  }

  /*
    accept one or more tokens. Run the machine as long as we have token to process.
  */
  accept(...tokens) {
    this.tokens.push(...tokens);

    while(this.running && this.tx < this.tokens.length) {
      this.step();
    }
  }

  /*
    Run the machine until it accepts
  */
  run() {
    while(this.running) {
      this.step();
    }
  }

  // ----------------------------------------------------------------------
  // Debugging
  // ----------------------------------------------------------------------

  /*
    Dump the machine's state onto the console. For debugging purposes.
  */
  dump() {
    console.log(this.cc.toString().padStart(6, "0"));
    console.log("------------------------------------------------");
    console.log(`         ${this.fp?.sp?.fn ?? "<noframe>"}`);
    console.log("------------------------------------------------");
    //           0123456789012345678901234567890123456789

    for(let i=0; i<this.code.length; i+=2) {
      const parts = [
        i.toString().padStart(6),
        (i == this.pc) ? ">" : " ",
        (this.code[i+0]?.toString() ?? "???").padEnd(12),
        (this.code[i+1]?.toString() ?? "???"),
      ];

      console.log(parts.join(" "));
    }
    console.log();

    console.log("------------------------------------------------");
    console.log("    bt   rule       pc   tx                     ");
    console.log("------------------------------------------------");
    //           0123456789012345678901234567890123456789

    for(let i=0; i<this.btx; ++i) {
      const parts = [
        i.toString().padStart(6),
        " ",
        (this.btstack[i].fp?.fn ?? "").toString().padEnd(8),
        this.btstack[i].pc.toString().padStart(4),
        this.btstack[i].tx.toString().padStart(4),
        // this.btstack[i].code,
      ];

      console.log(parts.join(" "));
    }

    console.log("------------------------------------------------");
    console.log("         data                                   ");
    console.log("------------------------------------------------");
    //           0123456789012345678901234567890123456789

    for(let p = this.sp; p; p=p.sp) {
      const parts = [
        "  ",
        (p == this.fp) ? "F" : " ",
        (p == this.btstack[this.btx-1]?.fp) ? "B" : " ",
        ("data" in p) ? "D" : " ",
        util.inspect(p.data ?? p, {breakLength: Infinity, compact: true, depth:0}),
      ];

      console.log(parts.join(" "));
    }

    console.log();
    console.log(`tx=${this.tx}`);
    console.log(`running=${this.running}  status=${this.status}`);
    console.log();
  }

  // ----------------------------------------------------------------------
  // High-level functions
  // ----------------------------------------------------------------------
  result() {
    return this.sp.sp.data;
  }
}

module.exports = {
  Parser,
  END,
};
