const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dffukbubx",
  api_key: process.env.CLOUDINARY_API_KEY || "891461973685955",
  api_secret: process.env.CLOUDINARY_API_SECRET || "F51-d9yOa9dM0qj1d9Bvd49h5q8",
});

module.exports = cloudinary;
