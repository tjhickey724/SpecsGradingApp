'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var instructorSchema = Schema( {
    userId: {type:ObjectId,ref:'User',index:true},
    status: {type:String,
             enum:['active','inactive','requested','denied'],
             default:'active'},
    createdAt: Date,
  } );

module.exports = mongoose.model( 'Instructor', instructorSchema );
