import { ClientSideBaseVisitor, ClientSideBasePluginConfig, LoadedFragment, getConfigValue, OMIT_TYPE, indentMultiline, RawClientSideBasePluginConfig } from '@graphql-codegen/visitor-plugin-common';
import autoBind from 'auto-bind';
import { GraphQLSchema, Kind } from 'graphql';
import { OperationDefinitionNode } from 'graphql';

export class GraphQLRequestVisitor extends ClientSideBaseVisitor<RawClientSideBasePluginConfig, ClientSideBasePluginConfig> {
  private _operationsToInclude: { node: OperationDefinitionNode; documentVariableName: string; operationType: string; operationResultType: string; operationVariablesTypes: string }[] = [];

  constructor(schema: GraphQLSchema, fragments: LoadedFragment[], rawConfig: RawClientSideBasePluginConfig) {
    super(schema, fragments, rawConfig, {});

    autoBind(this);
    this._additionalImports.push(`import { ApolloServerBase } from 'apollo-server-core';`);
    this._additionalImports.push(`import { print } from 'graphql';`);
  }

  protected buildOperation(node: OperationDefinitionNode, documentVariableName: string, operationType: string, operationResultType: string, operationVariablesTypes: string): string {
    this._operationsToInclude.push({
      node,
      documentVariableName,
      operationType,
      operationResultType,
      operationVariablesTypes,
    });

    return null;
  }

  public get sdkContent(): string {
    const allPossibleActions = this._operationsToInclude
      .map(o => {
        const optionalVariables = !o.node.variableDefinitions || o.node.variableDefinitions.length === 0 || o.node.variableDefinitions.every(v => v.type.kind !== Kind.NON_NULL_TYPE || v.defaultValue);

        return `${o.node.name.value}(variables${optionalVariables ? '?' : ''}: ${o.operationVariablesTypes}): Promise<${o.operationResultType}> {
  return client.executeOperation({query: print(${o.documentVariableName}), variables})
    .then((r) => {
      if (r.errors) throw r.errors[0]
      return {...(r.data as ${o.operationResultType})}
    });
}`;
      })
      .map(s => indentMultiline(s, 2));

    return `export function getSdk(client: ApolloServerBase) {
  return {
${allPossibleActions.join(',\n')}
  };
}`;
  }
}
