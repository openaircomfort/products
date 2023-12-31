import get from 'lodash/get';

import { getOtherInfos, getType } from './getAttributeInfos';

import type { Schema } from '@strapi/strapi';

const defaultFields = ['createdBy', 'updatedBy', 'publishedAt', 'id', '_id'];

const contentManagementUtilRemoveFieldsFromData = <
  TSchema extends Schema.ContentType,
  TData extends Record<keyof TSchema['attributes'], unknown>
>(
  data: TData,
  contentTypeSchema: TSchema,
  componentSchema: Record<string, Schema.Component>,
  fields = defaultFields
) => {
  const recursiveCleanData = <
    TSchemum extends Schema.Schema,
    TDatum extends { [P in keyof TSchemum['attributes']]: unknown }
  >(
    data: TDatum,
    schema: TSchemum
  ) => {
    return Object.keys(data).reduce((acc, current) => {
      const attrType = getType(schema, current);
      const value = get(data, current);
      const component = getOtherInfos(schema, [current, 'component']);
      const isRepeatable = getOtherInfos(schema, [current, 'repeatable']);
      let timestamps = get(schema, ['options', 'timestamps']);

      if (!Array.isArray(timestamps)) {
        timestamps = [];
      }

      if ([...fields, ...timestamps].indexOf(current) !== -1) {
        delete acc[current];

        return acc;
      }

      if (!value) {
        return acc;
      }

      if (attrType === 'dynamiczone' && Array.isArray(value)) {
        acc[current] = value.map((componentValue) => {
          const subCleanedData = recursiveCleanData(
            componentValue,
            componentSchema[componentValue.__component]
          );

          return subCleanedData;
        });

        return acc;
      }

      if (attrType === 'component') {
        if (isRepeatable && Array.isArray(value)) {
          acc[current] = value.map((compoData) => {
            const subCleanedData = recursiveCleanData(compoData, componentSchema[component]);

            return subCleanedData;
          });
        } else {
          acc[current] = recursiveCleanData(value, componentSchema[component]);
        }

        return acc;
      }

      return acc;
    }, Object.assign({}, data) as Record<string, unknown>);
  };

  return recursiveCleanData(data, contentTypeSchema);
};

export { contentManagementUtilRemoveFieldsFromData };
