import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();
const TrackerSchema = new mongoose.Schema({}, { strict: false });
const Tracker = mongoose.model('Tracker', TrackerSchema, 'userrepotrackers');
async function check() {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/repolens");
    const doc = await Tracker.find({});
    console.log(doc);
    process.exit(0);
}
check();
