'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

const sectionSchema = Schema( {
  name: String,
  email: String,
  courseId: {type:ObjectId,index:true},
  section: String,
  createdAt: Date,
} );

module.exports = mongoose.model( 'MathSection', sectionSchema );
