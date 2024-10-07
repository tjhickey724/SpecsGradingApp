'use strict';
const mongoose = require( 'mongoose' );
const Schema = mongoose.Schema;
const ObjectId = mongoose.Schema.Types.ObjectId;

var skillSchema = Schema( {
    name: String, // the name of the skill fitting on one line
    shortName: String, // a short name for the skill up to 6 characters
    description: String, // a description of the skill could be several lines
    level: String, // should be F (fundamental) or G (general) can expand later
    createdAt: Date,
    courseId: ObjectId,
    original: {type: ObjectId, index: true},
  } );

module.exports = mongoose.model( 'Skill', skillSchema );
