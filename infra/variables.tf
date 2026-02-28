variable "aws_region" {
  type    = string
  default = "us-east-2"
}

variable "project_name" {
  type    = string
  default = "quantum-battleship"
}

variable "lambda_source_dir" {
  type    = string
  default = "lambda_src"
}

variable "cache_prefix" {
  type    = string
  default = "cache/"
}

variable "game_ttl_seconds" {
  type    = number
  default = 21600 # 6h
}

variable "cors_origin" {
  type    = string
  default = "*"
}
