'use strict';
/*
  this lists the skills required for a course.
  The skills can be created by other people
  in their courses and add to this course.
*/
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var courseSkillSchema = Schema( {
  courseId: {type:ObjectId,index:true,ref:'Course'},
  skillId: {type:ObjectId,index:true,ref:'Skill'},
  createdAt: Date,
} );

module.exports = mongoose.model( 'CourseSkill', courseSkillSchema );
