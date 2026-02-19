import * as AWS from 'aws-sdk';
import moment from 'moment';
import _ from 'lodash';
import axios from 'axios';

const dynamodb = new AWS.DynamoDB.DocumentClient();

export const handler = async (event: any) => {
  const now = moment().format('YYYY-MM-DD');
  const data = _.get(event, 'body', '{}');
  const parsed = JSON.parse(data);

  const result = await dynamodb
    .get({ TableName: 'my-table', Key: { id: parsed.id } })
    .promise();

  const response = await axios.get('https://api.example.com/data');

  return {
    statusCode: 200,
    body: JSON.stringify({ date: now, item: result.Item, external: response.data }),
  };
};
