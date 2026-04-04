import React, {use, useState} from "react";
import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Cookie from "js-cookie";

const Home = () :ReactElement => {


  const navigate = useNavigate();

  const checkCookie = async () => {
    const sessionCookie = Cookie.get("scroll-rack-session");
    return await axios.get(`/api/user/session/${sessionCookie}`);
  }

  const {data} = useQuery({queryKey: ['sessionLookup'], queryFn: checkCookie})

  const user : {username: string, decks: {name: string, id: string}[]} = data?.data.user;

  const handleClickDeck = (e : React.MouseEvent, id : string) => {
    navigate(`/deck?id=${id}`);
  }

  return (
    <>
      Welcome Home
      <hr/>
      {user ? user.decks.map(({name, id}, index) => <a onClick={(e) => handleClickDeck(e, id)} key={name+ index}>{name}</a>) : <></>}
    </>
  )
}

export default Home;