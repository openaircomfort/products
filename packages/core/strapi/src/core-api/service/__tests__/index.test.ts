import { Schema } from '@strapi/types';
import { createService } from '../index';

describe('Default Service', () => {
  describe('Collection Type', () => {
    test('Creates default actions', () => {
      const contentType: Schema.ContentType = {
        kind: 'collectionType',
        modelType: 'contentType',
        uid: 'testModel',
        attributes: {},
        info: {
          singularName: 'test-model',
          displayName: 'Test Model',
          pluralName: 'test-models',
        },
      };

      const service = createService({ contentType });

      expect(service).toEqual({
        getFetchParams: expect.any(Function),
        find: expect.any(Function),
        findOne: expect.any(Function),
        create: expect.any(Function),
        update: expect.any(Function),
        delete: expect.any(Function),
      });
    });
  });

  describe('Single Type', () => {
    test('Creates default actions', () => {
      const contentType: Schema.ContentType = {
        kind: 'singleType',
        modelType: 'contentType',
        uid: 'testModel',
        attributes: {},
        info: {
          singularName: 'test-model',
          displayName: 'Test Model',
          pluralName: 'test-models',
        },
      };

      const service = createService({ contentType });

      expect(service).toEqual({
        getFetchParams: expect.any(Function),
        find: expect.any(Function),
        createOrUpdate: expect.any(Function),
        delete: expect.any(Function),
      });
    });

    describe('Passes the logic down to the entityService', () => {
      test('Creates data when no entity is found', async () => {
        const strapi = {
          entityService: {
            findMany: jest.fn(() => Promise.resolve(null)),
            create: jest.fn(() => Promise.resolve({ id: 1 })),
          },
          query() {
            return { count() {} };
          },
        };

        global.strapi = strapi;

        const contentType: Schema.ContentType = {
          kind: 'singleType',
          modelType: 'contentType',
          uid: 'testModel',
          attributes: {},
          info: {
            singularName: 'test-model',
            displayName: 'Test Model',
            pluralName: 'test-models',
          },
        };

        const service = createService({ contentType });

        const input = {};
        await service.createOrUpdate({ data: input });

        expect(strapi.entityService.findMany).toHaveBeenCalledWith('testModel', {
          publicationState: 'preview',
        });

        expect(strapi.entityService.create).toHaveBeenCalledWith('testModel', { data: input });
      });

      test('Updates data when entity is found', async () => {
        const strapi = {
          entityService: {
            findMany: jest.fn(() => Promise.resolve({ id: 1 })),
            update: jest.fn(() => Promise.resolve({ id: 1 })),
          },
          query() {
            return { count() {} };
          },
        };

        global.strapi = strapi;

        const contentType: Schema.ContentType = {
          kind: 'singleType',
          modelType: 'contentType',
          uid: 'testModel',
          attributes: {},
          info: {
            singularName: 'test-model',
            displayName: 'Test Model',
            pluralName: 'test-models',
          },
        };

        const service = createService({ contentType });

        const input = {};
        await service.createOrUpdate({ data: input });

        expect(strapi.entityService.findMany).toHaveBeenCalledWith('testModel', {
          populate: undefined,
          publicationState: 'preview',
        });

        expect(strapi.entityService.update).toHaveBeenCalledWith('testModel', 1, {
          data: input,
        });
      });

      test('Delete data when entity is found', async () => {
        const strapi = {
          entityService: {
            findMany: jest.fn(() => Promise.resolve({ id: 1 })),
            delete: jest.fn(() => Promise.resolve({ id: 1 })),
          },
        };

        global.strapi = strapi;

        const contentType: Schema.ContentType = {
          kind: 'singleType',
          modelType: 'contentType',
          uid: 'testModel',
          attributes: {},
          info: {
            singularName: 'test-model',
            displayName: 'Test Model',
            pluralName: 'test-models',
          },
        };
        const service = createService({ contentType });

        await service.delete();

        expect(strapi.entityService.findMany).toHaveBeenCalledWith('testModel', {
          populate: undefined,
          publicationState: 'live',
        });

        expect(strapi.entityService.delete).toHaveBeenCalledWith('testModel', 1);
      });
    });
  });
});
