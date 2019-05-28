const mongoose = require('mongoose')
const Schema = mongoose.Schema


const reviewSchema = new Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    rating: {
        type: Number,
        required: true
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
})



module.exports = mongoose.model('Review', reviewSchema)