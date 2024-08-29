'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var problemSchema = Schema( {
  courseId: {type:ObjectId,index:true}, // original course, control who gets to edit it
  psetId: {type:ObjectId,index:true}, // original pset
  description: String,
  problemText: String,
  mimeType: String, // type of the problem text (plain, markdown, tex, etc.)

  rubric: String,
  pendingReviews: mongoose.Schema.Types.Mixed, // deprecated ... this needs to be in PsetProblem
  createdAt: Date, // original creation date

  skills:[{type:ObjectId,ref:'Skill'}], 
  // MAP only needs 1 skill, but we keep this as a list for backward compatibility

  // used for determining whether and how to show the problem
  allowAnswers: Boolean, // default value
  visible: {type:Boolean, default: true}, //default value, actual value in PsetProblem
  submitable: {type:Boolean,default:true}, // default value
  answerable: {type:Boolean, default:true}, // default value
  peerReviewable:{type:Boolean, default:true}, // default value

  parentProblemId: {type:ObjectId, default:null}, 
  // this is used to link a problem to a parent problem,
  // if the problem is a variation of another problem the variant flag will be set
  variant: {type:Boolean, default:false}, // default value

  // DEPRECATED 
  points: Number, // deprecated  ... it is not needed in a MAP-based course


} );


module.exports = mongoose.model( 'Problem', problemSchema );
