'use strict'

process.title = "PdL_Download"
 
const http = require('follow-redirects').http
const fs = require('fs');
const path = require('path')
const axios = require('axios');
const convert = require('xml-js')

const download_dir = 'downloads'

if (!fs.existsSync(download_dir)){
  fs.mkdirSync(download_dir);
}

const errorlist = fs.createWriteStream('errorlist.txt')

function download(url, dest) {
  return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest, { flags: "wx" });

      const request = http.get(url, response => {
          if (response.statusCode === 200) {
              response.pipe(file);
          } else {
              file.close();
              fs.unlink(dest, () => {}); // Delete temp file
              reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
          }
      });

      request.on("error", err => {
          file.close();
          fs.unlink(dest, () => {}); // Delete temp file
          reject(err.message);
      });

      file.on("finish", () => {
          resolve();
      });

      file.on("error", err => {
          file.close();

          if (err.code === "EEXIST") {
              reject("File already exists");
          } else {
              fs.unlink(dest, () => {}); // Delete temp file
              reject(err.message);
          }
      });
  });
}


async function init() {
  let baseURL

    baseURL = `https://papodelouco.com/podcast_files/feedpapodelouco.xml`
    
    try {
      const r = await axios.get(baseURL)
      const episodeList = convert.xml2js(r.data, {compact: true}).rss.channel.item

      let episodeURL, fileName

      const promises = []

      Object.keys(episodeList).map(ep => {
        episodeURL = episodeList[ep]['enclosure']['_attributes'].url
        fileName = episodeURL.split('/')
        fileName = fileName[fileName.length - 1]

        console.log(`Downloading: ${fileName}`)

        promises.push(download(episodeURL, path.join(download_dir, fileName)))
        
      })

      await Promise.all(promises);
    } catch (e) {
      errorlist.write(`Erro to get rss XML [${baseURL}]\n`)
      console.log('Error', e)
    }
}

init()
