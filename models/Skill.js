'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var skillSchema = Schema( {
    name: String,
    description: String,
    createdAt: Date,
    courseId: ObjectId,
  } );

module.exports = mongoose.model( 'Skill', skillSchema );
