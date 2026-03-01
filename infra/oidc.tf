
############################################
# Role assumida pelo GitHub Actions p/ deploy de Lambdas
############################################

resource "aws_iam_role" "github_lambda_writer" {
  name               = "BattleshipGitHubLambdaWriterRole"
  assume_role_policy = data.aws_iam_policy_document.github_assume_role_lambda_writer.json
}

############################################
# Policy mínima: GitHub Actions pode atualizar código da Lambda
############################################

data "aws_iam_policy_document" "github_lambda_writer_policy" {
  statement {
    sid    = "UpdateLambdaCode"
    effect = "Allow"
    actions = [
      "lambda:UpdateFunctionCode",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration"
    ]
    resources = [
      aws_lambda_function.handler.arn
    ]
  }
}

resource "aws_iam_role_policy" "github_lambda_writer_inline" {
  name   = "BattleshipGitHubLambdaWriterPolicy"
  role   = aws_iam_role.github_lambda_writer.id
  policy = data.aws_iam_policy_document.github_lambda_writer_policy.json
}

############################################
# GitHub OIDC (Actions -> AssumeRole)
############################################

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  github_org    = "Quantum-Computing-Research"
  github_repo   = "Batalha-Naval-Quantica"

  # Restringe pra branch main (push) - bom pra segurança
  github_sub = "repo:${local.github_org}/${local.github_repo}:ref:refs/heads/backend_serverless"

  github_workflow_ref = "${local.github_org}/${local.github_repo}/.github/workflows/deploy-lambda-functions.yml@refs/heads/backend_serverless"
}

############################################
# GitHub OIDC (Actions -> AssumeRole)
############################################

data "aws_iam_policy_document" "github_assume_role_lambda_writer" {
  statement {
    effect = "Allow"

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    actions = ["sts:AssumeRoleWithWebIdentity"]

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    # exatamente como no print: amarra repo + branch
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = [local.github_sub]
    }

    # (Opcional e bem forte) amarra ao workflow:
    # condition {
    #   test     = "StringEquals"
    #   variable = "token.actions.githubusercontent.com:job_workflow_ref"
    #   values   = [local.github_workflow_ref]
    # }
  }
}