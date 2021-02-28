'use strict'

process.title = "PdL_Download"
 
const http = require('follow-redirects').http
const https = require('follow-redirects').https
const fs = require('fs');
const path = require('path')
const axios = require('axios');
const convert = require('xml-js')
const filenamify = require('filenamify')
const pLimit = require('p-limit');

//Configs
const rssURL = 'https://papodelouco.com/podcast_files/feedpapodelouco.xml'
const download_dir = 'downloads'
const simultaneousDownloads = 3
// ===##===


if (!fs.existsSync(download_dir)){
  fs.mkdirSync(download_dir);
}

const errorlist = fs.createWriteStream('errorlist.txt')

function download(url, dest) {
  return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest, { flags: "wx" });
      const protocol = url.split(':')[0]

      const handleRequest = response => {
        if (response.statusCode === 200) {
            response.pipe(file);
        } else {
            file.close();
            fs.unlink(dest, () => {}); // Delete temp file
            errorlist.write(`Error to download [${url}]\n`)
            reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
        }
      }

      console.log(`Downloading: ${dest}`)
      const request = (protocol === 'http') ? http.get(url, handleRequest) : https.get(url, handleRequest)

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
    const limit = pLimit(simultaneousDownloads);
    const baseURL = rssURL

    try {
      const r = await axios.get(baseURL)
      const episodeList = convert.xml2js(r.data, {compact: true}).rss.channel.item

      const promises = []

      Object.keys(episodeList).map(ep => {
        const episode = episodeList[ep]

        const title = filenamify((episode['title']['_text']) ? episode['title']['_text'] : episode['title']['_cdata'])
        const episodeURL = decodeURIComponent(episode['enclosure']['_attributes'].url)
        
        let exten = episodeURL.split('/')
        exten = exten[exten.length - 1].split('.')
        exten = exten[exten.length - 1]
        
        const fileName = `${title}.${exten}`

        promises.push(limit(() => download(episodeURL, path.join(download_dir, fileName))))
      })

      await Promise.all(promises);
    } catch (e) {
      errorlist.write(`Error to get rss XML [${baseURL}]\n`)
      console.log('Error', e)
    }
}

init()
