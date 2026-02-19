import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: { id: string }) => {
  const result = await docClient.send(
    new GetCommand({ TableName: 'my-table', Key: { id: event.id } }),
  );

  return {
    statusCode: 200,
    body: JSON.stringify({ item: result.Item }),
  };
};
