const axios = require('axios').default;

export default async (req, res) => {
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

  try {
    const weatherApiKey = process.env.OPENSKY_API_KEY || '';

    await axios.get(
      `https://api.openweathermap.org/data/2.5/weather?lat=39.8695944&lon=-86.0855265&appid=${weatherApiKey}&units=imperial`
    )
      .then((json) => {
        response = formatWeather(response, json.data);

        utc_offset = json.data.timezone;
      });
  } catch (error) {
    console.log(error);
  }

  return processDateAndTime(utc_offset, response);
}

function processDateAndTime(utc_offset, response) {
  utc_offset = utc_offset / 3600;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  const day_of_week = dayNames[server_date.getDay()];
  response.day_of_week = day_of_week;

  response.line_1 = `Today is ${day_of_week}, ${date}`;

  response.brightness = server_hours > 7 && server_hours < 20 ? 255 : 100;

  return response;
}

function formatWeather(response, json) {
  const temperature = Math.round(json.main.temp);
  const currently = json.weather[0].description;
  const currentlyFormatted =
    currently.charAt(0).toUpperCase() + currently.substring(1);

  response.temperature = temperature;
  response.currently = currentlyFormatted;
  response.line_2 = `${currentlyFormatted}, ${temperature}F`;

  return response;
}
