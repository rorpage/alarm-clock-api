import redis from "async-redis"
import fetch from "node-fetch"

export default async (req, res) => {
  let response = processDateAndTime();

  try {
    const weather_time_to_live = 900;
    const key = 'weather';
    const host = process.env.REDIS_URL || 'redis://localhost:6379';
    const redis_client = redis.createClient(host);
    const redis_data = await redis_client.get(key);

    if (redis_data === null) {
      const weatherApiKey = process.env.WEATHER_API_KEY || '';

      await fetch(
        `https://api.darksky.net/forecast/${weatherApiKey}/39.7707286,-86.0703977?exclude=minutely,hourly,alerts,flags`
      )
      .then((res) => res.json())
      .then((json) => {
        const temperature = Math.round(json.currently.temperature);
        const currently = json.currently.summary;

        response.temperature = temperature;
        response.currently = currently;

        redis_client.setex(key, weather_time_to_live, JSON.stringify(json));
      });
    } else {
      const cached_data = JSON.parse(redis_data);
      const temperature = Math.round(cached_data.currently.temperature);
      const currently = cached_data.currently.summary;

      response.temperature = temperature;
      response.currently = currently;
    }
  } catch (error) {
    console.log(error);
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

  res.json(response);
}

function processDateAndTime() {
  let response = {};

  const dayNames = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];

  const utc_offset = -5;

  const client_date = new Date();
  const utc = client_date.getTime() + (client_date.getTimezoneOffset() * 60000);
  const server_date = new Date(utc + (3600000 * utc_offset));

  const server_hours = server_date.getHours();
  const hour = (server_hours + 11) % 12 + 1;
  const hour_display = (hour < 10) ? `0${hour}` : hour;
  const minutes = server_date.getMinutes();
  const minutes_display = (minutes < 10) ? `0${minutes}` : minutes;
  const time = `${hour_display}:${minutes_display}`;

  const time_digits = [];
  time_digits.push(parseInt(time[0]));
  time_digits.push(parseInt(time[1]));
  time_digits.push(parseInt(time[3]));
  time_digits.push(parseInt(time[4]));

  response.time = time;
  response.time_digits = time_digits;

  const month = server_date.getMonth() + 1;
  const month_display = (month < 10) ? `0${month}` : month;
  const day = server_date.getDate();
  const day_display = (day < 10) ? `0${day}` : day;
  const date = `${month_display}/${day_display}`;

  response.date = date;
  response.day_of_week = dayNames[server_date.getDay()];

  response.brightness = (server_hours > 7 && server_hours < 20) ? 255 : 128;

  return response;
}
