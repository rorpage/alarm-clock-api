import axios from 'axios';
import { createClient } from 'redis';

export default async function(request, response) {
  const { query } = request;
  const mini = query.mini;

  const weather_response = await getResponse(mini);

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept'
  );

  response.json(weather_response);
};

async function getResponse(mini) {
  let response = {};

  let data = {};

  const key = 'weather';
  const weather_time_to_live = 900;

  const host = process.env.REDIS_URL || 'redis://localhost:6379';
  const redis_client = createClient({ url: host });

  try {
    await redis_client.connect();

    const redis_data = await redis_client.get(key);

    if (redis_data !== null) {
      data = JSON.parse(redis_data);
    } else {
      const weatherApiKey = process.env.OPENSKY_API_KEY || '';

      await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=39.8695944&lon=-86.0855265&appid=${weatherApiKey}&units=imperial`
      )
        .then(async (json) => {
          data = json.data;

          await redis_client.setEx(key, weather_time_to_live, JSON.stringify(json.data));
        });
    }
  } catch (error) {
    console.log(error);
  } finally {
    redis_client.quit();
  }

  const temperature = data.main.temp;
  const utc_offset = data.timezone || -4;

  if (!mini) {
    response.temp_f = Math.round(temperature);
    response.temperature = Math.round(temperature);
  }

  response.pressure = parseFloat((data.main.pressure / 33.89).toFixed(2));
  response.temp_c = fahrenheitToCelsius(temperature);

  return processDateAndTime(utc_offset, response, mini);
}

function processDateAndTime(utc_offset, response, mini) {
  utc_offset = utc_offset / 3600;

  const client_date = new Date();
  const utc = client_date.getTime() + client_date.getTimezoneOffset() * 60000;
  const server_date = new Date(utc + 3600000 * utc_offset);

  const server_hours = server_date.getHours();
  const hour = mini ? server_hours : ((server_hours + 11) % 12) + 1;
  const hour_display = hour < 10 ? `0${hour}` : hour;

  const minutes = server_date.getMinutes();
  const minutes_display = minutes < 10 ? `0${minutes}` : minutes;

  const time = `${hour_display}:${minutes_display}`;

  const time_digits = [];
  time_digits.push(parseInt(time[0]));
  time_digits.push(parseInt(time[1]));
  time_digits.push(parseInt(time[3]));
  time_digits.push(parseInt(time[4]));

  const month = server_date.getMonth() + 1;
  const month_display = month < 10 ? `0${month}` : month;
  const day = server_date.getDate();
  const day_display = day < 10 ? `0${day}` : day;
  const date = `${month_display}/${day_display}`;

  if (!mini) {
    response.date = date;
    response.time = time;
  }

  response.time_digits = time_digits;
  response.brightness = server_hours > 7 && server_hours < 20 ? 255 : 100;

  return response;
}

function fahrenheitToCelsius(temperature) {
  return Math.round((temperature - 32) * (5 / 9));
}
