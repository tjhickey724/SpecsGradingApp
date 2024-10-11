'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemSetSchema = Schema( {
  courseId: {type:ObjectId,ref:'Course',index:true},
  name: String,
  createdAt: Date,
  visible: Boolean,
  grading: {type:String,
            enum:['in-app','external'],
            default:'in-app'},
  status:{type:String,
          enum:['in-prep','active','completed','graded'],
          default:'in-prep'},
  makeup: {type:ObjectId, ref:'ProblemSet'}, // if this has a makeup, this is its id; else it is null
  makeupOf: {type: ObjectId, ref:'ProblemSet' } // if this is a makeup, this is the original pset; else it is null
} );

module.exports = mongoose.model( 'ProblemSet', problemSetSchema );
