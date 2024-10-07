'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseSchema = Schema( {
  name: String,
  description:String,
  ownerId: {type:ObjectId,index:true},
  coursePinMLA: {type:Number,index:true},
  courseId:{type:ObjectId,index:true,ref:'Course'}, //mla Course id
  createdAt: Date,

} );

module.exports = mongoose.model( 'MathCourse', courseSchema );
