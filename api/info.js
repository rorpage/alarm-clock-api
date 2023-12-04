import axios from 'axios';
import { createClient } from 'redis';

export default async function(_req, res) {
  const response = await getResponse();

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );

  res.json(response);
};

async function getResponse() {
  let response = {};
  let utc_offset = -4;

  const key = 'weather';
  const weather_time_to_live = 900;

  const host = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis_client = createClient({ url: host });

  try {
    await redis_client.connect();

    const redis_data = await redis_client.get(key);

    if (redis_data === null) {
      const weatherApiKey = process.env.OPENSKY_API_KEY || '';

      await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=39.8695944&lon=-86.0855265&appid=${weatherApiKey}&units=imperial`
      )
        .then(async (json) => {
          const temperature = json.data.main.temp;
          response.temperature = Math.round(temperature);
          response.temp_c = fahrenheitToCelsius(temperature);

          utc_offset = json.data.timezone;

          await redis_client.setEx(key, weather_time_to_live, JSON.stringify(json.data));
        });
    } else {
      const cached_data = JSON.parse(redis_data);

      const temperature = cached_data.main.temp;
      response.temperature = Math.round(temperature);
      response.temp_c = fahrenheitToCelsius(temperature);

      utc_offset = cached_data.timezone;
    }
  } catch (error) {
    console.log(error);
  } finally {
    redis_client.quit();
  }

  return processDateAndTime(utc_offset, response);
}

function processDateAndTime(utc_offset, response) {
  utc_offset = utc_offset / 3600;

  const client_date = new Date();
  const utc = client_date.getTime() + client_date.getTimezoneOffset() * 60000;
  const server_date = new Date(utc + 3600000 * utc_offset);

  const server_hours = server_date.getHours();
  const hour = ((server_hours + 11) % 12) + 1;
  const hour_display = hour < 10 ? `0${hour}` : hour;
  const minutes = server_date.getMinutes();
  const minutes_display = minutes < 10 ? `0${minutes}` : minutes;
  const time = `${hour_display}:${minutes_display}`;

  const time_digits = [];
  time_digits.push(parseInt(time[0]));
  time_digits.push(parseInt(time[1]));
  time_digits.push(parseInt(time[3]));
  time_digits.push(parseInt(time[4]));

  response.time = time;
  response.time_digits = time_digits;

  const month = server_date.getMonth() + 1;
  const month_display = month < 10 ? `0${month}` : month;
  const day = server_date.getDate();
  const day_display = day < 10 ? `0${day}` : day;
  const date = `${month_display}/${day_display}`;

  response.date = date;
  response.brightness = server_hours > 7 && server_hours < 20 ? 255 : 100;

  return response;
}

function fahrenheitToCelsius(temperature) {
  return Math.round((temperature - 32) * (5 / 9));
}
