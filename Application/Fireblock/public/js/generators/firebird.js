'use strict';

goog.provide('Blockly.Firebird');

goog.require('Blockly.Generator');


/**
 * Firebird code generator.
 * @type !Blockly.Generator
 */
Blockly.Firebird = new Blockly.Generator('Firebird');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.Firebird.addReservedWords(
  // http://arduino.cc/en/Reference/HomePage
  'port_config,init,if,else,for,switch,case,while,do,break,continue,return,goto,define,include,HIGH,LOW,INPUT,OUTPUT,INPUT_PULLUP,true,false,interger, constants,floating,point,void,bookean,char,unsigned,byte,int,word,long,float,double,string,String,array,static, volatile,const,sizeof,pinMode,digitalWrite,digitalRead,analogReference,analogRead,analogWrite,tone,noTone,shiftOut,shitIn,pulseIn,millis,micros,delay,delayMicroseconds,min,max,abs,constrain,map,pow,sqrt,sin,cos,tan,randomSeed,random,lowByte,highByte,bitRead,bitWrite,bitSet,bitClear,bit,attachInterrupt,detachInterrupt,interrupts,noInterrupts'
);

/**
 * Order of operation ENUMs.
 *
 */
Blockly.Firebird.ORDER_ATOMIC = 0;         // 0 "" ...
Blockly.Firebird.ORDER_UNARY_POSTFIX = 1;  // expr++ expr-- () [] .
Blockly.Firebird.ORDER_UNARY_PREFIX = 2;   // -expr !expr ~expr ++expr --expr
Blockly.Firebird.ORDER_MULTIPLICATIVE = 3; // * / % ~/
Blockly.Firebird.ORDER_ADDITIVE = 4;       // + -
Blockly.Firebird.ORDER_SHIFT = 5;          // << >>
Blockly.Firebird.ORDER_RELATIONAL = 6;     // is is! >= > <= <
Blockly.Firebird.ORDER_EQUALITY = 7;       // == != === !==
Blockly.Firebird.ORDER_BITWISE_AND = 8;    // &
Blockly.Firebird.ORDER_BITWISE_XOR = 9;    // ^
Blockly.Firebird.ORDER_BITWISE_OR = 10;    // |
Blockly.Firebird.ORDER_LOGICAL_AND = 11;   // &&
Blockly.Firebird.ORDER_LOGICAL_OR = 12;    // ||
Blockly.Firebird.ORDER_CONDITIONAL = 13;   // expr ? expr : expr
Blockly.Firebird.ORDER_ASSIGNMENT = 14;    // = *= /= ~/= %= += -= <<= >>= &= ^= |=
Blockly.Firebird.ORDER_NONE = 99;          // (...)

/*
 * Firebird Board profiles
 *
 */
 /*
var profile = {
  arduino: {
    description: "Firebird standard-compatible board",
    digital: [["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"], ["7", "7"], ["8", "8"], ["9", "9"], ["10", "10"], ["11", "11"], ["12", "12"], ["13", "13"], ["A0", "A0"], ["A1", "A1"], ["A2", "A2"], ["A3", "A3"], ["A4", "A4"], ["A5", "A5"]],
    analog: [["A0", "A0"], ["A1", "A1"], ["A2", "A2"], ["A3", "A3"], ["A4", "A4"], ["A5", "A5"]],
    serial: 9600
  },
  arduino_mega: {
    description: "Firebird Mega-compatible board"
    //53 digital
    //15 analog
  }
};
//set default profile to arduino standard-compatible board
profile["default"] = profile["arduino"];
//alert(profile.default.digital[0]);
*/
/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.Firebird.init = function(workspace) {
  // Create a dictionary of definitions to be printed before setups.
  Blockly.Firebird.definitions_ = Object.create(null);
  // Create a dictionary of setups to be printed before the code.
  Blockly.Firebird.setups_ = Object.create(null);

	if (!Blockly.Firebird.variableDB_) {
		Blockly.Firebird.variableDB_ =
				new Blockly.Names(Blockly.Firebird.RESERVED_WORDS_);
	} else {
		Blockly.Firebird.variableDB_.reset();
	}

	var defvars = [];
	var variables = Blockly.Variables.allVariables(workspace);
	for (var x = 0; x < variables.length; x++) {
		defvars[x] = '  int ' +
				Blockly.Firebird.variableDB_.getName(variables[x],
				Blockly.Variables.NAME_TYPE) + ';\n';
	}
	Blockly.Firebird.definitions_['variables'] = defvars.join('\n');
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Firebird.finish = function(code) {
  // Indent every line.
  code = '  ' + code.replace(/\n/g, '\n  ');
  code = code.replace(/\n\s+$/, '\n');

  // Convert the definitions dictionary into a list.
  var imports = [];
  var variables =[];
  var definitions = [];
  var fcpu ='';
  for (var name in Blockly.Firebird.definitions_) {
    var def = Blockly.Firebird.definitions_[name];
    if(name == 'defineFCPU'){
      fcpu = def;
    } else if (def.match(/^#include/)) {
      imports.push(def);
    } else if (name === 'variables') {
      variables.push(def);
    } else {
      definitions.push(def);
    }
  }
  var allDefs = fcpu + imports.join('\n')+"\n#include <avr/interrupt.h>\n#include <avr/io.h>\n#include <util/delay.h>" + '\n\n' + definitions.join('\n');
  return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code +'\n';
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.  A trailing semicolon is needed to make this legal.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Firebird.scrubNakedValue = function(line) {
  return line + ';\n';
};

/**
 * Encode a string as a properly escaped Firebird string, complete with quotes.
 * @param {string} string Text to encode.
 * @return {string} Firebird string.
 * @private
 */
Blockly.Firebird.quote_ = function(string) {
  // TODO: This is a quick hack.  Replace with goog.string.quote
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/\$/g, '\\$')
                 .replace(/'/g, '\\\'');
  return '\"' + string + '\"';
};

/**
 * Common tasks for generating Firebird from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Firebird code created for this block.
 * @return {string} Firebird code with comments and subsequent blocks added.
 * @private
 */
Blockly.Firebird.scrub_ = function(block, code) {
  if (code === null) {
    // Block has handled code generation itself.
    return '';
  }
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    if (comment) {
      commentCode += Blockly.Firebird.prefixLines(comment, '// ') + '\n';
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var x = 0; x < block.inputList.length; x++) {
      if (block.inputList[x].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[x].connection.targetBlock();
        if (childBlock) {
          var comment = Blockly.Firebird.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Firebird.prefixLines(comment, '// ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.Firebird.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};
