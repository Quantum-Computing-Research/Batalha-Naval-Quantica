variable "region" {
  type        = string
  description = "Região AWS"
  default     = "us-east-1"
}

variable "ami_id" {
  type        = string
  description = "AMI ID da EC2"
  default     = "ami-0c55b159cbfafe1f0"
}

variable "instance_type" {
  type        = string
  description = "Tipo da EC2"
  default     = "t2.micro"
}

variable "key_name" {
  type        = string
  description = "Chave SSH EC2"
  default     = "minha-chave-aws"
}

variable "subnet_id" {
  type        = string
  description = "Subnet ID"
  default     = "subnet-02ae3d5cb2e409a08"
}