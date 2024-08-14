'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemCatalogCardSchema = 
 Schema( {
  courseId: {type:ObjectId,index:true},
  problemId: {type:ObjectId,index:true,ref:'Problem'},
  organization: String,
  tags: String, // comma separated list of tags
  notes: String, // notes for the instructor
  ancestors: [ObjectId],
  createdAt: Date,
  lastModified: Date,
} );
/*
    ancestors is a list of the ancestors of the problem
      the first element is the parent of the problem
      the last element is the root of the problem
    organization is the organization that owns the problem
    tags is a comma separated list of tags
    notes is notes for the instructor
    createdAt is the date the problem was created
    lastModified is the date the problem was last modified
*/

module.exports = 
   mongoose.model( 'ProblemCatalogCard', 
                    problemCatalogCardSchema );
